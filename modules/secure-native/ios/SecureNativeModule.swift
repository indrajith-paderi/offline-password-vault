import CryptoKit
import ExpoModulesCore
import Foundation
import Security
import UIKit
import UniformTypeIdentifiers

private let seKeyTag = "offline_vault.se_key_v1"
private let peerKeyTag = "offline_vault.peer_pub_v1"
private let fallbackSecretTag = "offline_vault.device_secret_v1"
private let macInfo = Data("OV-device-mac-v1".utf8)

final class DecryptFailedException: Exception {
  override var code: String { "ERR_DECRYPT" }
  override var reason: String { "Authentication failed" }
}

final class BadKeyException: Exception {
  override var code: String { "ERR_KEY" }
  override var reason: String { "Key must be 32 bytes" }
}

final class KeychainException: GenericException<OSStatus> {
  override var reason: String { "Keychain error \(param)" }
}

public final class SecureNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SecureNative")

    // ---- Hardware-bound device secret ---------------------------------------------------
    // Secure Enclave can't do HMAC, so we do ECDH between an SE-resident P-256 key and a
    // fixed peer key, HKDF the shared secret, then HMAC. The SE key blob is only usable by
    // this device's enclave; nothing here survives a restore to another phone.
    AsyncFunction("deviceMac") { (data: Data) -> Data in
      let key = try deviceMacKey()
      return Data(HMAC<SHA256>.authenticationCode(for: data, using: key))
    }

    AsyncFunction("deviceKeySecurityLevel") { () -> String in
      SecureEnclave.isAvailable ? "secure_enclave" : "keychain"
    }

    AsyncFunction("deleteDeviceKey") {
      for tag in [seKeyTag, peerKeyTag, fallbackSecretTag] {
        deleteKeychainItem(tag)
      }
    }

    // ---- AES-256-GCM via CryptoKit -------------------------------------------------------
    // Output layout: nonce(12) || ciphertext || tag(16).
    Function("aesGcmEncrypt") { (key: Data, plaintext: Data, aad: Data) -> Data in
      guard key.count == 32 else { throw BadKeyException() }
      let box = try AES.GCM.seal(plaintext, using: SymmetricKey(data: key), nonce: AES.GCM.Nonce(), authenticating: aad)
      guard let combined = box.combined else { throw BadKeyException() }
      return combined
    }

    Function("aesGcmDecrypt") { (key: Data, blob: Data, aad: Data) -> Data in
      guard key.count == 32 else { throw BadKeyException() }
      do {
        let box = try AES.GCM.SealedBox(combined: blob)
        return try AES.GCM.open(box, using: SymmetricKey(data: key), authenticating: aad)
      } catch {
        throw DecryptFailedException()
      }
    }

    // ---- Clocks ---------------------------------------------------------------------------
    Function("monotonicMs") { () -> Double in
      // CLOCK_MONOTONIC on Darwin keeps counting during sleep and ignores wall-clock changes.
      Double(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1_000_000
    }

    Function("bootId") { () -> String in
      var size = 0
      sysctlbyname("kern.bootsessionuuid", nil, &size, nil, 0)
      guard size > 0 else { return "unknown" }
      var buf = [CChar](repeating: 0, count: size)
      sysctlbyname("kern.bootsessionuuid", &buf, &size, nil, 0)
      return String(cString: buf)
    }

    // ---- Clipboard ------------------------------------------------------------------------
    // localOnly keeps it off Universal Clipboard (which would beam it to your Mac).
    AsyncFunction("copySensitive") { (text: String, expiresInMs: Double) in
      UIPasteboard.general.setItems(
        [[UTType.plainText.identifier: text]],
        options: [
          .localOnly: true,
          .expirationDate: Date().addingTimeInterval(expiresInMs / 1000),
        ]
      )
    }.runOnQueue(.main)

    AsyncFunction("clearClipboard") {
      UIPasteboard.general.items = []
    }.runOnQueue(.main)

    // ---- Integrity / tamper signals ---------------------------------------------------------
    Function("integrityReport") { () -> [String: Any?] in
      [
        "debuggerAttached": isDebuggerAttached(),
        "debuggable": false,
        "compromised": looksJailbroken(),
        "signingCertSha256": nil,
        "installer": nil,
      ]
    }
  }
}

// MARK: - Device key

private func deviceMacKey() throws -> SymmetricKey {
  if SecureEnclave.isAvailable {
    let se = try loadOrCreateSecureEnclaveKey()
    let peer = try loadOrCreatePeerPublicKey()
    let shared = try se.sharedSecretFromKeyAgreement(with: peer)
    return shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: Data(), sharedInfo: macInfo, outputByteCount: 32)
  }
  // Simulator / very old hardware: keychain secret, this-device-only.
  if let secret = readKeychainItem(fallbackSecretTag) {
    return SymmetricKey(data: secret)
  }
  var bytes = Data(count: 32)
  let status = bytes.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!) }
  guard status == errSecSuccess else { throw KeychainException(status) }
  try writeKeychainItem(fallbackSecretTag, bytes)
  return SymmetricKey(data: bytes)
}

private func loadOrCreateSecureEnclaveKey() throws -> SecureEnclave.P256.KeyAgreement.PrivateKey {
  if let blob = readKeychainItem(seKeyTag) {
    return try SecureEnclave.P256.KeyAgreement.PrivateKey(dataRepresentation: blob)
  }
  var error: Unmanaged<CFError>?
  guard let access = SecAccessControlCreateWithFlags(
    nil, kSecAttrAccessibleWhenUnlockedThisDeviceOnly, .privateKeyUsage, &error
  ) else {
    throw error!.takeRetainedValue() as Error
  }
  let key = try SecureEnclave.P256.KeyAgreement.PrivateKey(accessControl: access)
  try writeKeychainItem(seKeyTag, key.dataRepresentation)
  return key
}

private func loadOrCreatePeerPublicKey() throws -> P256.KeyAgreement.PublicKey {
  if let raw = readKeychainItem(peerKeyTag) {
    return try P256.KeyAgreement.PublicKey(rawRepresentation: raw)
  }
  let pub = P256.KeyAgreement.PrivateKey().publicKey
  try writeKeychainItem(peerKeyTag, pub.rawRepresentation)
  return pub
}

// MARK: - Keychain helpers (generic passwords, never synced, this device only)

private func baseQuery(_ tag: String) -> [String: Any] {
  [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "offline_vault",
    kSecAttrAccount as String: tag,
    kSecAttrSynchronizable as String: kCFBooleanFalse!,
  ]
}

private func readKeychainItem(_ tag: String) -> Data? {
  var query = baseQuery(tag)
  query[kSecReturnData as String] = true
  query[kSecMatchLimit as String] = kSecMatchLimitOne
  var out: AnyObject?
  guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess else { return nil }
  return out as? Data
}

private func writeKeychainItem(_ tag: String, _ data: Data) throws {
  deleteKeychainItem(tag)
  var query = baseQuery(tag)
  query[kSecValueData as String] = data
  query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
  let status = SecItemAdd(query as CFDictionary, nil)
  guard status == errSecSuccess else { throw KeychainException(status) }
}

private func deleteKeychainItem(_ tag: String) {
  SecItemDelete(baseQuery(tag) as CFDictionary)
}

// MARK: - Integrity heuristics (bypassable; they raise the bar, nothing more)

private func isDebuggerAttached() -> Bool {
  var info = kinfo_proc()
  var size = MemoryLayout<kinfo_proc>.stride
  var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
  guard sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0) == 0 else { return false }
  return (info.kp_proc.p_flag & P_TRACED) != 0
}

private func looksJailbroken() -> Bool {
  #if targetEnvironment(simulator)
    return false
  #else
    let paths = [
      "/Applications/Cydia.app", "/Applications/Sileo.app", "/var/jb", "/bin/bash",
      "/usr/sbin/sshd", "/etc/apt", "/private/var/lib/apt", "/usr/libexec/cydia",
    ]
    if paths.contains(where: { FileManager.default.fileExists(atPath: $0) }) { return true }
    let probe = "/private/ov_jb_probe.txt"
    if (try? "x".write(toFile: probe, atomically: true, encoding: .utf8)) != nil {
      try? FileManager.default.removeItem(atPath: probe)
      return true
    }
    return false
  #endif
}
