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
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

class DecryptFailedException : CodedException("ERR_DECRYPT", "Authentication failed", null)
class BadKeyException : CodedException("ERR_KEY", "Key must be 32 bytes", null)

class SecureNativeModule : Module() {
  private val deviceKey = DeviceKey()

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No React context")

  override fun definition() = ModuleDefinition {
    Name("SecureNative")

    AsyncFunction("deviceMac") { data: ByteArray ->
      try {
        deviceKey.mac(data)
      } finally {
        data.fill(0)
      }
    }

    AsyncFunction("deviceKeySecurityLevel") { deviceKey.securityLevel() }

    AsyncFunction("deleteDeviceKey") { deviceKey.delete() }

    Function("aesGcmEncrypt") { key: ByteArray, plaintext: ByteArray, aad: ByteArray ->
      try {
        AesGcm.seal(key, plaintext, aad)
      } catch (e: AesGcmKeyException) {
        throw BadKeyException()
      } finally {
        key.fill(0)
        plaintext.fill(0)
      }
    }

    Function("aesGcmDecrypt") { key: ByteArray, blob: ByteArray, aad: ByteArray ->
      try {
        AesGcm.open(key, blob, aad)
      } catch (e: AesGcmKeyException) {
        throw BadKeyException()
      } catch (e: AesGcmAuthException) {
        throw DecryptFailedException()
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
        "platform" to "android",
        "debuggerAttached" to (Debug.isDebuggerConnected() || Debug.waitingForDebugger()),
        "debuggable" to ((appInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0),
        "compromised" to looksRooted(),
        "signingCertSha256" to signingCertSha256(),
        "installer" to installerPackage(),
      )
    }
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
