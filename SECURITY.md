# Security design

Offline Vault is a password manager with no backend, no account, and no network permission.
This document explains how the encryption works and, just as importantly, where its limits are.

## Key hierarchy (envelope encryption)

```
PIN (4 digits) ──Argon2id(salt, 64 MiB, t=3)──► pinHash
                                                  │
hardware key (StrongBox / TEE / Secure Enclave) ──HMAC-SHA256──► KEK
                                                                  │
random 256-bit vault key ◄──AES-256-GCM unwrap (AAD = header)─────┘
        │
        └──AES-256-GCM (AAD = record id)──► each record (summary blob + secret blob)
```

- **Vault key**: 32 random bytes from libsodium's CSPRNG. Encrypts every record.
- **KEK**: never stored. It's rebuilt on each unlock from the PIN *and* a non-exportable hardware key.
  - Android: HMAC-SHA256 key in Android Keystore, StrongBox first, then TEE, `setUnlockedDeviceRequired`.
  - iOS: ECDH between a Secure Enclave P-256 key and a fixed peer key, then HKDF, then HMAC. The Secure Enclave can't do HMAC directly.
- **Header**: version, Argon2id params, salt and wrapped vault key, stored in SQLite. All of it is AEAD-authenticated.
- **Records**: `id | AES-GCM(summary) | AES-GCM(secret)`. Titles, usernames and timestamps are encrypted too. The AAD binds each blob to its record id, so blobs can't be swapped between rows.
- **Change PIN** re-wraps the vault key only. Records are untouched.

AES-GCM runs on the platform's own implementation (JCA on Android, CryptoKit on iOS). Argon2id comes from libsodium. There is no custom cryptography.

## Why a 4-digit PIN needs hardware binding

A 4-digit PIN has 10,000 possible values. If the KEK depended only on Argon2id(PIN), anyone who copied the database could try all 10,000 on a laptop in a few hours, and the "3 tries per hour" rule would do nothing.

Mixing in a hardware key that can't be extracted means guesses can only be made **on this phone, through this app**, where the lockout applies. If you copy the database to another device, even the correct PIN won't open it (there's a test for this).

**Residual risk:** an attacker who has *root code execution on your unlocked phone* can call the hardware key directly and skip the app's lockout. Argon2id then costs them around 1 second per guess, so 10,000 PINs take about 3 hours. If that threat matters to you, a longer passcode is the only real fix. The code supports it; only `PIN_PATTERN` in `src/vault/keys.ts` and the PIN pad would need to change.

## Lockout: 3 wrong PINs, then 1 hour

- Each attempt is written to storage **before** the PIN is checked, so killing the app mid-check still counts the guess.
- Timestamps record wall-clock time, monotonic time and a boot id. On the same boot, both clocks must agree that the hour has passed, so changing the system clock doesn't skip the lockout.
- If the lockout state is corrupted, the app treats it as a fresh lock (it fails closed).
- **Known gap:** after a reboot only the wall clock is left. Rebooting and moving the clock forward ends a lockout early. Fixing this offline would need a trusted time source, which we don't have.
- Lockout state lives in Keystore/Keychain-encrypted storage. A root attacker could reset it (see residual risk above).

## Biometrics

- Biometric unlock releases a copy of the vault key stored by `expo-secure-store` under a key that needs a strong biometric (`requireAuthentication`, `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`). Enrolling a new fingerprint or face invalidates it.
- The PIN is never stored. Biometrics can't reveal it.
- The key that biometrics release is checked against an encrypted canary before the app trusts it.
- The PIN is required again after 72 hours.
- Someone with your finger and your phone can open the vault. That's the trade-off biometrics make. Turn them off if this is in your threat model.

## Platform hardening

| Measure | Where |
| --- | --- |
| No `INTERNET` or other network permissions (removed with `tools:node="remove"`, including from libraries) | `plugins/withHardenedAndroid.js` |
| `allowBackup=false`, plus data-extraction rules that exclude everything from cloud backup and device-to-device transfer | same |
| `usesCleartextTraffic=false` | same |
| `FLAG_SECURE` (no screenshots, screen recording or recents thumbnail); app-switcher blur on iOS | `App.tsx` |
| Auto-lock when the app goes to the background, and after inactivity (30 s to 5 min) | `src/security/autoLock.ts` |
| Clipboard flagged sensitive (Android 13+), `localOnly` on iOS (no Universal Clipboard), cleared after 30 s and on lock | `src/security/clipboard.ts` |
| PIN typed on an in-app keypad, so system and third-party keyboards never see it | `src/ui/components/PinPad.tsx` |
| `console.*` removed from production bundles | `babel.config.js` |
| SQLite `secure_delete=ON` | `src/vault/sqliteStore.ts` |
| Release builds refuse to unlock when a debugger is attached, the build is debuggable, or the signing certificate doesn't match | `src/security/integrity.ts` |
| Warning shown on rooted or jailbroken devices | same |

To turn on the signing-certificate check, put your release cert's SHA-256 in `app.json` under `expo.extra.signingCertSha256` (format `AB:CD:…`).

## Memory handling

Keys are kept in `Uint8Array`s and zeroed on lock. Native code zeroes its copies too. Secrets are decrypted one entry at a time, only when you open that entry. The navigation stack (and any decrypted screen state) is discarded on every lock.

**Limit:** JavaScript strings are immutable and garbage-collected, so a password you've displayed or edited may stay in the JS heap until GC runs. No React Native app can fully prevent this.

## Backups

- Format: `"OVBK" | version | Argon2id params | salt | createdAt | appVersion | AES-256-GCM(payload)`. The whole header is the AAD, so changing the date or KDF params breaks decryption.
- Key: Argon2id(backup password, fresh salt, 128 MiB, t=4). **No device keys are involved**, so any phone can open the file.
- The backup password must be 12+ characters with 3 character classes, or 20+ characters. It's the only protection once the file leaves the phone.
- KDF params read from a file are range-checked before any work starts, so a crafted file can't exhaust memory.
- On restore, the file is fully decrypted and validated before the vault is touched. A new phone gets a **new** hardware key, a new vault key and a new PIN.
- There's no plaintext CSV/JSON export.
- "Secure delete" of exported files isn't promised: wear-levelled flash makes overwrite-then-delete unreliable. The app overwrites its own temp copies as a best effort. The protection is that the file was encrypted to begin with.

## Out of scope

A compromised OS, malware with accessibility or root privileges, keyloggers, shoulder-surfing, and someone using your phone while the vault is unlocked. Auto-lock and `FLAG_SECURE` reduce these risks but can't remove them.

## Before you trust it with real passwords

This code hasn't had an independent security audit. Get one, or at least have someone who isn't the author review `src/vault/`, `src/backup/format.ts` and `modules/secure-native/`.
