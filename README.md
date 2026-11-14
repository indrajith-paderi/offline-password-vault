# Keystill

Offline password manager for Android and iOS. Your keys, kept still. No backend, no accounts, no network permission.

## Features

- AES-256-GCM encrypted entries
- 4-digit PIN, Argon2id + hardware-bound key
- 3 failed attempts per hour, then a 1 hour lockout
- Biometric unlock
- Auto-lock, screenshot blocking, clipboard auto-clear
- Encrypted backup and restore for moving to a new phone

## Requirements

- Node 20+
- Android SDK, or Xcode for iOS
- Doesn't run in Expo Go (uses native modules)

## Setup

```bash
npm install
npm test
npm run typecheck
```

## Testing

| Command | What it runs |
| --- | --- |
| `npm test` | Jest: unit, property-based, fuzz, golden-file and store contract tests |
| `npm run test:ci` | Same, with coverage thresholds enforced |
| `npm run mutation` | Stryker mutation testing (slow) |
| `npm run vectors` | Regenerate Kotlin/Swift AES-GCM vectors from `modules/secure-native/test-vectors` |
| `swift test` in `modules/secure-native/ios` | CryptoKit AES-GCM against the shared vectors (macOS) |
| `./gradlew :secure-native:testDebugUnitTest` in `android/` | JCA AES-GCM against the shared vectors |
| `./gradlew :secure-native:connectedDebugAndroidTest` in `android/` | Keystore device key on an emulator or phone |
| `maestro test .maestro` | End-to-end flows against an installed release build |

Mocks live in `__mocks__/` and model the real native contracts: device-only secure storage, biometric cancel and invalidation, hardware key failures, and SQLite via `node:sqlite` with disk-failure injection. Tests run in random order and fail on any console output.

Regenerate the backup golden file only when the format version changes:

```bash
UPDATE_FIXTURES=1 npx jest backupFixture
```

CI runs all of the above. Mutation testing runs weekly.

## Development build

Metro needs network access, so dev builds keep `INTERNET`:

```bash
VAULT_DEV_NETWORK=1 npx expo prebuild --clean
npx expo run:android
```

## Release build

```bash
npx expo prebuild --clean
npx expo run:android --variant release
```

Check the permissions:

```bash
aapt dump permissions android/app/build/outputs/apk/release/app-release.apk
```

Set `expo.extra.signingCertSha256` in `app.json` to turn on the signature check.

After changing dependencies, regenerate the license list:

```bash
npm run licenses
```

## Assets

Icon and splash sources are in `assets/brand`. Regenerate the PNGs with:

```bash
npm run assets
```

## Moving to a new phone

1. Settings → Export encrypted backup
2. Copy the `.enc` file over USB, OTG or Quick Share
3. On the new phone, choose Restore from a backup file, then set a PIN

The new phone generates its own hardware key.

## Project layout

```
modules/secure-native   Kotlin/Swift: hardware keys, AES-GCM, clipboard, integrity
plugins/                Android manifest hardening
src/crypto              Argon2id, AES-GCM, password generator
src/vault               key wrapping, lockout, storage
src/backup              backup format, file handling
src/security            auto-lock, clipboard, integrity checks
src/ui                  screens and components
```

## Security

See [SECURITY.md](SECURITY.md).

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

MIT
