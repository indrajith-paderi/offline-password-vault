import CryptoKit
import Foundation

enum AesGcmError: Error, Equatable {
  case badKey
  case badNonce
  case authenticationFailed
}

enum AesGcm {
  static let keyBytes = 32
  static let nonceBytes = 12
  static let tagBytes = 16

  static func seal(key: Data, plaintext: Data, aad: Data, nonce: Data? = nil) throws -> Data {
    guard key.count == keyBytes else { throw AesGcmError.badKey }
    let n: AES.GCM.Nonce
    if let nonce {
      guard nonce.count == nonceBytes else { throw AesGcmError.badNonce }
      n = try AES.GCM.Nonce(data: nonce)
    } else {
      n = AES.GCM.Nonce()
    }
    let box = try AES.GCM.seal(plaintext, using: SymmetricKey(data: key), nonce: n, authenticating: aad)
    guard let combined = box.combined else { throw AesGcmError.badNonce }
    return combined
  }

  static func open(key: Data, blob: Data, aad: Data) throws -> Data {
    guard key.count == keyBytes else { throw AesGcmError.badKey }
    guard blob.count >= nonceBytes + tagBytes else { throw AesGcmError.authenticationFailed }
    do {
      let box = try AES.GCM.SealedBox(combined: blob)
      return try AES.GCM.open(box, using: SymmetricKey(data: key), authenticating: aad)
    } catch {
      throw AesGcmError.authenticationFailed
    }
  }
}
