package dev.offlinevault.securenative

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DeviceKeyTest {
  private val key = DeviceKey("offline_vault_test_key")

  @Before
  fun setUp() = key.delete()

  @After
  fun tearDown() = key.delete()

  @Test
  fun macIsStableForTheSameKey() {
    val a = key.mac(byteArrayOf(1, 2, 3))
    val b = key.mac(byteArrayOf(1, 2, 3))
    assertEquals(32, a.size)
    assertArrayEquals(a, b)
  }

  @Test
  fun macDependsOnInput() {
    assertNotEquals(key.mac(byteArrayOf(1)).toList(), key.mac(byteArrayOf(2)).toList())
  }

  @Test
  fun deletingTheKeyChangesEveryMac() {
    val before = key.mac(byteArrayOf(7))
    key.delete()
    assertFalse(key.exists())
    val after = key.mac(byteArrayOf(7))
    assertTrue(key.exists())
    assertNotEquals(before.toList(), after.toList())
  }

  @Test
  fun keysAreIndependentPerAlias() {
    val other = DeviceKey("offline_vault_test_key_2")
    try {
      assertNotEquals(key.mac(byteArrayOf(1)).toList(), other.mac(byteArrayOf(1)).toList())
    } finally {
      other.delete()
    }
  }

  @Test
  fun reportsAKnownSecurityLevel() {
    assertTrue(key.securityLevel() in setOf("strongbox", "tee", "software"))
  }
}
