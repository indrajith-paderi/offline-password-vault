package dev.offlinevault.securenative

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class AesGcmTest {
  private fun hex(s: String): ByteArray = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

  @Test
  fun sealMatchesPublishedVectors() {
    for (v in TestVectors.gcm) {
      val out = AesGcm.seal(hex(v.key), hex(v.plaintext), hex(v.aad), hex(v.nonce))
      assertArrayEquals(v.name, hex(v.nonce + v.ciphertext + v.tag), out)
    }
  }

  @Test
  fun openMatchesPublishedVectors() {
    for (v in TestVectors.gcm) {
      val out = AesGcm.open(hex(v.key), hex(v.nonce + v.ciphertext + v.tag), hex(v.aad))
      assertArrayEquals(v.name, hex(v.plaintext), out)
    }
  }

  @Test
  fun everyFlippedBitIsRejected() {
    val v = TestVectors.gcm.last()
    val blob = hex(v.nonce + v.ciphertext + v.tag)
    for (i in blob.indices) {
      val bad = blob.copyOf()
      bad[i] = (bad[i].toInt() xor 1).toByte()
      assertThrows(AesGcmAuthException::class.java) { AesGcm.open(hex(v.key), bad, hex(v.aad)) }
    }
  }

  @Test
  fun wrongAadIsRejected() {
    val v = TestVectors.gcm.last()
    assertThrows(AesGcmAuthException::class.java) {
      AesGcm.open(hex(v.key), hex(v.nonce + v.ciphertext + v.tag), byteArrayOf(1))
    }
  }

  @Test
  fun shortBlobsAreRejected() {
    for (n in 0 until AesGcm.NONCE_BYTES + AesGcm.TAG_BYTES) {
      assertThrows(AesGcmAuthException::class.java) { AesGcm.open(ByteArray(32), ByteArray(n), ByteArray(0)) }
    }
  }

  @Test
  fun keysMustBe32Bytes() {
    for (size in listOf(0, 16, 24, 31, 33)) {
      assertThrows(AesGcmKeyException::class.java) { AesGcm.seal(ByteArray(size), ByteArray(1), ByteArray(0)) }
      assertThrows(AesGcmKeyException::class.java) { AesGcm.open(ByteArray(size), ByteArray(40), ByteArray(0)) }
    }
  }

  @Test
  fun randomNoncesDoNotRepeat() {
    val seen = HashSet<String>()
    repeat(10_000) {
      val n = AesGcm.seal(ByteArray(32), ByteArray(1), ByteArray(0)).copyOfRange(0, AesGcm.NONCE_BYTES)
      seen.add(n.joinToString("") { b -> "%02x".format(b) })
    }
    assertEquals(10_000, seen.size)
  }

  @Test
  fun roundTripsWithRandomNonce() {
    val key = ByteArray(32) { it.toByte() }
    val pt = "pässwörd 🔐".toByteArray()
    val blob = AesGcm.seal(key, pt, byteArrayOf(9))
    assertEquals(AesGcm.NONCE_BYTES + pt.size + AesGcm.TAG_BYTES, blob.size)
    assertArrayEquals(pt, AesGcm.open(key, blob, byteArrayOf(9)))
  }
}
