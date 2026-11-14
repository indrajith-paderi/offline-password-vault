# Offline Vault

A password manager that keeps everything on your phone. No server, no account, no internet permission.

- AES-256-GCM for every record, with a random 256-bit vault key
- 4-digit PIN → Argon2id → combined with a non-exportable hardware key (StrongBox/TEE/Secure Enclave)
- 3 wrong PINs within an hour → locked for an hour
- Fingerprint / Face unlock (the PIN is still required every 72 h)
- Auto-lock, screenshot blocking, a clipboard that clears itself, release builds that can't log
- Encrypted, portable `vault_backup_*.enc` files for moving to a new phone over USB, OTG or Quick Share

Read [SECURITY.md](SECURITY.md) for the design and its limits.

## Stack

Expo SDK 58 / React Native 0.88, TypeScript, `expo-sqlite`, `expo-secure-store`, `react-native-libsodium` (Argon2id), and a local native module (`modules/secure-native`, Kotlin + Swift) for hardware keys, AES-GCM, the clipboard and integrity checks.

The app uses native code, so it **won't run in Expo Go**. Build a dev or release build instead.

## Develop

```bash
npm install
npm test            # crypto, lockout, vault and backup tests (Node)
npm run typecheck

# Dev builds need INTERNET to reach Metro. This flag keeps it in the generated manifest:
VAULT_DEV_NETWORK=1 npx expo prebuild --clean
npx expo run:android      # or run:ios on a Mac
```

## Release build (no network permission)

```bash
npx expo prebuild --clean          # without VAULT_DEV_NETWORK: INTERNET is stripped
npx expo run:android --variant release
```

Check the result:

```bash
aapt dump permissions android/app/build/outputs/apk/release/app-release.apk   # no INTERNET
```

Then put your release signing certificate's SHA-256 in `app.json` → `expo.extra.signingCertSha256`, so a re-signed APK refuses to unlock.

## Moving to a new phone

1. Old phone: **Settings → Export encrypted backup**. Choose a strong backup password.
2. Copy the `.enc` file over USB, an OTG drive or Quick Share. Don't use email or cloud drives.
3. New phone: install the app, tap **Restore from a backup file**, enter the backup password, and choose a new PIN.

The new phone generates its own hardware key. Nothing from the old phone's secure hardware is reused.

**If you forget your PIN and have no backup, your data can't be recovered. That's by design.**
