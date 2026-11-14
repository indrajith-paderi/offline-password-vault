import XCTest
@testable import SecureNativeCore

final class AesGcmTests: XCTestCase {
  private func hex(_ s: String) -> Data {
    var data = Data(capacity: s.count / 2)
    var index = s.startIndex
    while index < s.endIndex {
      let next = s.index(index, offsetBy: 2)
      data.append(UInt8(s[index..<next], radix: 16)!)
      index = next
    }
    return data
  }

  func testSealMatchesPublishedVectors() throws {
    for v in TestVectors.gcm {
      let out = try AesGcm.seal(key: hex(v.key), plaintext: hex(v.plaintext), aad: hex(v.aad), nonce: hex(v.nonce))
      XCTAssertEqual(out, hex(v.nonce + v.ciphertext + v.tag), v.name)
    }
  }

  func testOpenMatchesPublishedVectors() throws {
    for v in TestVectors.gcm {
      let out = try AesGcm.open(key: hex(v.key), blob: hex(v.nonce + v.ciphertext + v.tag), aad: hex(v.aad))
      XCTAssertEqual(out, hex(v.plaintext), v.name)
    }
  }

  func testEveryFlippedBitIsRejected() {
    let v = TestVectors.gcm.last!
    let blob = hex(v.nonce + v.ciphertext + v.tag)
    for i in 0..<blob.count {
      var bad = blob
      bad[i] ^= 1
      XCTAssertThrowsError(try AesGcm.open(key: hex(v.key), blob: bad, aad: hex(v.aad))) { error in
        XCTAssertEqual(error as? AesGcmError, .authenticationFailed)
      }
    }
  }

  func testWrongAadIsRejected() {
    let v = TestVectors.gcm.last!
    XCTAssertThrowsError(try AesGcm.open(key: hex(v.key), blob: hex(v.nonce + v.ciphertext + v.tag), aad: Data([1])))
  }

  func testShortBlobsAreRejected() {
    for n in 0..<(AesGcm.nonceBytes + AesGcm.tagBytes) {
      XCTAssertThrowsError(try AesGcm.open(key: Data(count: 32), blob: Data(count: n), aad: Data())) { error in
        XCTAssertEqual(error as? AesGcmError, .authenticationFailed)
      }
    }
  }

  func testKeysMustBe32Bytes() {
    for size in [0, 16, 24, 31, 33] {
      XCTAssertThrowsError(try AesGcm.seal(key: Data(count: size), plaintext: Data([1]), aad: Data())) { error in
        XCTAssertEqual(error as? AesGcmError, .badKey)
      }
      XCTAssertThrowsError(try AesGcm.open(key: Data(count: size), blob: Data(count: 40), aad: Data())) { error in
        XCTAssertEqual(error as? AesGcmError, .badKey)
      }
    }
  }

  func testNonceMustBe12Bytes() {
    XCTAssertThrowsError(try AesGcm.seal(key: Data(count: 32), plaintext: Data(), aad: Data(), nonce: Data(count: 16))) { error in
      XCTAssertEqual(error as? AesGcmError, .badNonce)
    }
  }

  func testRandomNoncesDoNotRepeat() throws {
    var seen = Set<Data>()
    for _ in 0..<10_000 {
      seen.insert(try AesGcm.seal(key: Data(count: 32), plaintext: Data([1]), aad: Data()).prefix(AesGcm.nonceBytes))
    }
    XCTAssertEqual(seen.count, 10_000)
  }

  func testRoundTripsWithRandomNonce() throws {
    let key = Data((0..<32).map { UInt8($0) })
    let pt = Data("pässwörd 🔐".utf8)
    let blob = try AesGcm.seal(key: key, plaintext: pt, aad: Data([9]))
    XCTAssertEqual(blob.count, AesGcm.nonceBytes + pt.count + AesGcm.tagBytes)
    XCTAssertEqual(try AesGcm.open(key: key, blob: blob, aad: Data([9])), pt)
  }
}
