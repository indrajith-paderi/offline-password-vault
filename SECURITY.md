# Security

This document describes how Keystill protects the vault and where that protection stops. Everything here can be checked against the source. The relevant files are listed in each section.

## Reporting a vulnerability

Please report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/indrajith-paderi/offline-password-vault/security/advisories/new). Don't open a public issue. Include the app version, the platform, and steps to reproduce if you have them.

## Keys

Code: `src/vault/keys.ts`, `src/crypto/kdf.ts`, `modules/secure-native`

```
pinHash  = Argon2id(PIN, salt)                    t=3, m=64 MiB
KEK      = HMAC-SHA256(hwKey, ctx || salt || pinHash)
vaultKey = AES-256-GCM-Open(KEK, wrappedKey, aad=header)
```

`hwKey` never leaves the device's secure hardware where the hardware exists:

- **Android:** an HMAC-SHA256 key in the Android Keystore. It's created in StrongBox when available, otherwise in the TEE, and requires the device to be unlocked. If a device rejects those options, the app retries without them (see Known limitations).
- **iOS:** ECDH between a Secure Enclave P-256 key and a stored public key, then HKDF-SHA256. On devices without a Secure Enclave, a random 32-byte secret in the Keychain is used instead.

All Keychain items are stored as this-device-only and are never synced.

`vaultKey` is 256 random bits and encrypts every record. Each record is stored as two AES-256-GCM blobs: a summary (title, username, URL, timestamps) and a secret (password, notes). Each blob's AAD includes the record id and which half it is, so blobs can't be swapped between records or between halves.

Changing the PIN re-wraps `vaultKey` and leaves the records as they are.

AES-GCM comes from the platform (JCA on Android, CryptoKit on iOS). Argon2id comes from libsodium. The Kotlin and Swift AES-GCM code is tested against shared test vectors in `modules/secure-native/test-vectors`.

## Why a 4-digit PIN

A 4-digit PIN has only 10,000 values. Without `hwKey`, an attacker with a copy of the database could try them all offline in hours. Because `hwKey` is bound to the device, every guess has to run on that phone and go through the lockout.

## Lockout

Code: `src/vault/lockout.ts`

- 3 wrong PINs within 1 hour block unlocking for 1 hour
- Each attempt is recorded before the PIN is checked, so killing the app mid-check still counts it
- The lockout timer checks the wall clock against a monotonic clock and a boot id, so changing the time doesn't shorten it while the phone stays on
- If the stored lockout state is corrupt, the app treats itself as locked

## Biometric unlock

Code: `src/vault/vault.ts`

- When enabled, a copy of `vaultKey` is stored in secure storage behind biometric authentication (Android Keystore / iOS Keychain), readable only on this device while a passcode is set. Changing enrolled fingerprints or faces invalidates it.
- Before use, the released key is checked against an encrypted canary. If the check fails, biometric unlock is turned off.
- The PIN is required again after 72 hours.

## Backups

Code: `src/backup/format.ts`, `src/backup/passwordPolicy.ts`

```
"OVBK" | version (1) | kdf id (1) | ops (4) | memKiB (4) | salt (16) | createdAt (8) | appVer len (1) | appVer | AES-GCM blob
```

- The key is Argon2id(backup password, salt) with t=4, m=128 MiB. No device keys are involved, so a backup can be restored on another phone.
- The whole header is the AAD, so changing any header field makes decryption fail.
- KDF parameters are bounds-checked before derivation, so a crafted file can't make the app use weak parameters or run out of memory.
- Files over 50 MB are rejected, and every entry is validated before anything is written to the vault.
- The backup password needs at least 12 characters with 3 character types, or 20+ characters, and can't be too repetitive or contain a common password.

## Platform hardening

- **Android:**
  - Network permissions are removed from release builds, and cleartext traffic is disabled (`plugins/withHardenedAndroid.js`).
  - Cloud backup and device-to-device transfer are disabled.
  - `FLAG_SECURE` blocks screenshots and screen recording.
- **iOS:** the app switcher shows a blurred preview.
- **Auto-lock:** the vault locks when the app goes to the background and after inactivity. Locking also clears a password the app copied.
- **Clipboard:** copied passwords are marked sensitive on Android and `localOnly` on iOS, and cleared after 30 seconds.
- **PIN keypad:** PIN entry uses an in-app keypad, not the system keyboard.
- **Logging:** `console.*` calls are removed from production builds.
- **Storage:** SQLite runs with `secure_delete` on.
- **Integrity checks (release builds):** the app refuses to unlock if a debugger is attached, the build is debuggable, or (on Android, when `signingCertSha256` is set in `app.json`) the signing certificate doesn't match.
- **Rooted or jailbroken devices:** the app shows a warning but still works.

## Known limitations

- Root access on an unlocked device can call `hwKey` directly and bypass the lockout. Trying every PIN then takes about 3 hours.
- After a reboot only the wall clock is available, so moving the clock forward can shorten a lockout.
- On Android devices without hardware-backed Keystore, and on iOS devices without a Secure Enclave, `hwKey` is protected by software only. Most phones from the last several years have the hardware.
- JavaScript strings can't be zeroed, so decrypted values can stay in memory until garbage collection.
- Overwriting data before deleting it is best effort on flash storage.
- Root and jailbreak detection uses simple file and build checks, and determined users can hide from it.
- The app has not had an independent security audit.
