# Security

## Reporting

Use GitHub private vulnerability reporting. Don't open public issues for vulnerabilities.

## Keys

```
pinHash  = Argon2id(PIN, salt)                    t=3, m=64 MiB
KEK      = HMAC-SHA256(hwKey, ctx || salt || pinHash)
vaultKey = AES-256-GCM-Open(KEK, wrappedKey, aad=header)
```

- `hwKey`
  - Android: Keystore HMAC key. StrongBox if available, otherwise TEE.
  - iOS: ECDH with a Secure Enclave P-256 key, then HKDF.
- `vaultKey` is 256 bits of random data and encrypts all records.
- Each record has two AES-256-GCM blobs, summary and secret. The AAD is the record id.
- Changing the PIN re-wraps `vaultKey` only.
- AES-GCM comes from the platform (JCA, CryptoKit). Argon2id comes from libsodium.

## PIN

A 4-digit PIN has 10^4 values. Without `hwKey`, a copied database falls to an offline attack in hours. With it, every guess needs the device and goes through the lockout.

## Lockout

- 3 failures within 1 hour, then a 1 hour block
- Each attempt is saved before the PIN is checked
- The wall clock is checked against a monotonic clock and a boot id
- Corrupt lockout state counts as locked

## Biometrics

- A copy of `vaultKey` sits behind a biometric-bound Keystore/Keychain key. Changing enrolled fingerprints or faces invalidates it.
- The released key is checked against an encrypted canary before use.
- The PIN is required every 72 h.

## Backups

```
"OVBK" | ver | kdf | ops | memKiB | salt | createdAt | appVer | nonce | ct | tag
```

- Key: Argon2id(backup password, salt), t=4, m=128 MiB. No device keys involved.
- The header is the AAD.
- KDF params are bounds-checked before derivation.
- The full payload is validated before anything is written.
- Password: 12+ characters with 3 character classes, or 20+ characters.

## Platform

- Android: network permissions removed, backup and device transfer disabled, cleartext traffic disabled
- `FLAG_SECURE` on Android, app switcher blur on iOS
- Auto-lock on background and after inactivity
- Clipboard: sensitive flag on Android 13+, `localOnly` on iOS, cleared after 30 s
- In-app PIN keypad
- `console.*` stripped from production builds
- SQLite `secure_delete`
- Release builds refuse to unlock if a debugger is attached, the build is debuggable or the signature doesn't match
- Warning on rooted or jailbroken devices

## Known limitations

- Root access on an unlocked device can call `hwKey` directly and skip the lockout. Trying every PIN then takes about 3 h.
- After a reboot only the wall clock is available, so moving it forward can shorten a lockout.
- JS strings can't be zeroed. Decrypted values can stay in the heap until GC.
- Overwriting files before deleting them is best effort on flash storage.
- No independent audit yet.
