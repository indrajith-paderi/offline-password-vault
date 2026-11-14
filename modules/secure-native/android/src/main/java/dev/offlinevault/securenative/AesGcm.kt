package dev.offlinevault.securenative

import java.security.GeneralSecurityException
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class AesGcmKeyException : IllegalArgumentException("Key must be 32 bytes")

class AesGcmAuthException : GeneralSecurityException("Authentication failed")

object AesGcm {
  const val KEY_BYTES = 32
  const val NONCE_BYTES = 12
  const val TAG_BYTES = 16

  private val random = SecureRandom()

  fun seal(key: ByteArray, plaintext: ByteArray, aad: ByteArray, nonce: ByteArray? = null): ByteArray {
    if (key.size != KEY_BYTES) throw AesGcmKeyException()
    val iv = nonce ?: ByteArray(NONCE_BYTES).also { random.nextBytes(it) }
    require(iv.size == NONCE_BYTES) { "Nonce must be $NONCE_BYTES bytes" }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BYTES * 8, iv))
    cipher.updateAAD(aad)
    return iv + cipher.doFinal(plaintext)
  }

  fun open(key: ByteArray, blob: ByteArray, aad: ByteArray): ByteArray {
    if (key.size != KEY_BYTES) throw AesGcmKeyException()
    if (blob.size < NONCE_BYTES + TAG_BYTES) throw AesGcmAuthException()
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(
      Cipher.DECRYPT_MODE,
      SecretKeySpec(key, "AES"),
      GCMParameterSpec(TAG_BYTES * 8, blob, 0, NONCE_BYTES),
    )
    cipher.updateAAD(aad)
    return try {
      cipher.doFinal(blob, NONCE_BYTES, blob.size - NONCE_BYTES)
    } catch (e: GeneralSecurityException) {
      throw AesGcmAuthException()
    }
  }
}
