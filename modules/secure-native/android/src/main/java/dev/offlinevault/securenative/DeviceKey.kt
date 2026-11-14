package dev.offlinevault.securenative

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory

class DeviceKey(private val alias: String = DEFAULT_ALIAS) {
  companion object {
    const val DEFAULT_ALIAS = "offline_vault_device_mac_v1"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

  fun mac(data: ByteArray): ByteArray {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(getOrCreate())
    return mac.doFinal(data)
  }

  fun securityLevel(): String {
    val key = getOrCreate()
    val info = SecretKeyFactory.getInstance(key.algorithm, ANDROID_KEYSTORE)
      .getKeySpec(key, KeyInfo::class.java) as KeyInfo
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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

  fun exists(): Boolean = keyStore().containsAlias(alias)

  fun delete() {
    val ks = keyStore()
    if (ks.containsAlias(alias)) ks.deleteEntry(alias)
  }

  private fun getOrCreate(): SecretKey {
    val ks = keyStore()
    (ks.getKey(alias, null) as? SecretKey)?.let { return it }

    val attempts = listOf(true to true, false to true, false to false)
    var lastError: Exception? = null
    for ((strongBox, unlockedOnly) in attempts) {
      try {
        val spec = KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
          .setIsStrongBoxBacked(strongBox)
          .setUnlockedDeviceRequired(unlockedOnly)
          .build()
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_HMAC_SHA256, ANDROID_KEYSTORE)
        gen.init(spec)
        return gen.generateKey()
      } catch (e: Exception) {
        lastError = e
        runCatching { ks.deleteEntry(alias) }
      }
    }
    throw lastError ?: IllegalStateException("Could not create device key")
  }
}
