package dev.offlinevault.securenative

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import android.os.PersistableBundle
import android.os.SystemClock
import android.provider.Settings
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private const val DEVICE_KEY_ALIAS = "offline_vault_device_mac_v1"
private const val ANDROID_KEYSTORE = "AndroidKeyStore"
private const val GCM_NONCE_BYTES = 12
private const val GCM_TAG_BITS = 128

class DecryptFailedException : CodedException("ERR_DECRYPT", "Authentication failed", null)
class BadKeyException : CodedException("ERR_KEY", "Key must be 32 bytes", null)

class SecureNativeModule : Module() {
  private val random = SecureRandom()

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  override fun definition() = ModuleDefinition {
    Name("SecureNative")

    AsyncFunction("deviceMac") { data: ByteArray ->
      try {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(getOrCreateDeviceKey())
        mac.doFinal(data)
      } finally {
        data.fill(0)
      }
    }

    AsyncFunction("deviceKeySecurityLevel") {
      val key = getOrCreateDeviceKey()
      val info = SecretKeyFactory.getInstance(key.algorithm, ANDROID_KEYSTORE)
        .getKeySpec(key, KeyInfo::class.java) as KeyInfo
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        when (info.securityLevel) {
          KeyProperties.SECURITY_LEVEL_STRONGBOX -> "strongbox"
          KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT -> "tee"
          else -> "software"
        }
      } else {
        @Suppress("DEPRECATION")
        if (info.isInsideSecureHardware) "tee" else "software"
      }
    }

    AsyncFunction("deleteDeviceKey") {
      val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
      if (ks.containsAlias(DEVICE_KEY_ALIAS)) ks.deleteEntry(DEVICE_KEY_ALIAS)
    }

    Function("aesGcmEncrypt") { key: ByteArray, plaintext: ByteArray, aad: ByteArray ->
      try {
        if (key.size != 32) throw BadKeyException()
        val nonce = ByteArray(GCM_NONCE_BYTES).also { random.nextBytes(it) }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(GCM_TAG_BITS, nonce))
        cipher.updateAAD(aad)
        nonce + cipher.doFinal(plaintext)
      } finally {
        key.fill(0)
        plaintext.fill(0)
      }
    }

    Function("aesGcmDecrypt") { key: ByteArray, blob: ByteArray, aad: ByteArray ->
      try {
        if (key.size != 32) throw BadKeyException()
        if (blob.size < GCM_NONCE_BYTES + GCM_TAG_BITS / 8) throw DecryptFailedException()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
          Cipher.DECRYPT_MODE,
          SecretKeySpec(key, "AES"),
          GCMParameterSpec(GCM_TAG_BITS, blob, 0, GCM_NONCE_BYTES),
        )
        cipher.updateAAD(aad)
        try {
          cipher.doFinal(blob, GCM_NONCE_BYTES, blob.size - GCM_NONCE_BYTES)
        } catch (e: javax.crypto.AEADBadTagException) {
          throw DecryptFailedException()
        }
      } finally {
        key.fill(0)
      }
    }

    Function("monotonicMs") { SystemClock.elapsedRealtime().toDouble() }

    Function("bootId") {
      Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1).toString()
    }

    AsyncFunction("copySensitive") { text: String, _expiresInMs: Double ->
      val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newPlainText("", text)
      clip.description.extras = PersistableBundle().apply {
        val key = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          ClipDescription.EXTRA_IS_SENSITIVE
        } else {
          "android.content.extra.IS_SENSITIVE"
        }
        putBoolean(key, true)
      }
      cm.setPrimaryClip(clip)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clearClipboard") {
      val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      cm.clearPrimaryClip()
    }.runOnQueue(Queues.MAIN)

    Function("integrityReport") {
      val appInfo = context.applicationInfo
      mapOf(
        "debuggerAttached" to (Debug.isDebuggerConnected() || Debug.waitingForDebugger()),
        "debuggable" to ((appInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0),
        "compromised" to looksRooted(),
        "signingCertSha256" to signingCertSha256(),
        "installer" to installerPackage(),
      )
    }
  }

  private fun getOrCreateDeviceKey(): SecretKey {
    val ks = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    (ks.getKey(DEVICE_KEY_ALIAS, null) as? SecretKey)?.let { return it }

    val attempts = listOf(true to true, false to true, false to false)
    var lastError: Exception? = null
    for ((strongBox, unlockedOnly) in attempts) {
      try {
        val spec = KeyGenParameterSpec.Builder(DEVICE_KEY_ALIAS, KeyProperties.PURPOSE_SIGN)
          .setIsStrongBoxBacked(strongBox)
          .setUnlockedDeviceRequired(unlockedOnly)
          .build()
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, ANDROID_KEYSTORE)
        gen.init(spec)
        return gen.generateKey()
      } catch (e: Exception) {
        lastError = e
        runCatching { ks.deleteEntry(DEVICE_KEY_ALIAS) }
      }
    }
    throw lastError ?: IllegalStateException("Could not create device key")
  }

  private fun signingCertSha256(): String? = runCatching {
    val pm = context.packageManager
    val info = pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
    val signers = info.signingInfo?.apkContentsSigners ?: return@runCatching null
    if (signers.size != 1) return@runCatching "multiple"
    MessageDigest.getInstance("SHA-256").digest(signers[0].toByteArray())
      .joinToString(":") { "%02X".format(it) }
  }.getOrNull()

  private fun installerPackage(): String? = runCatching {
    val pm = context.packageManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      pm.getInstallSourceInfo(context.packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      pm.getInstallerPackageName(context.packageName)
    }
  }.getOrNull()

  private fun looksRooted(): Boolean {
    val suPaths = listOf(
      "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su", "/data/local/su",
      "/data/local/bin/su", "/data/local/xbin/su", "/system/sd/xbin/su",
      "/system/app/Superuser.apk", "/data/adb/magisk", "/sbin/.magisk",
    )
    if (suPaths.any { File(it).exists() }) return true
    if (Build.TAGS?.contains("test-keys") == true) return true
    return false
  }
}
