# Keystill

Keystill is an offline password manager for Android and iOS, built with Expo and React Native. It has no backend and no accounts, and release builds on Android ship without any network permission. Your data stays in an encrypted SQLite database on the phone. The only way it leaves is as a password-protected backup file that you export yourself.

## Features

- Entries with a title, username, URL, password and notes, each encrypted with AES-256-GCM
- 4-digit PIN, stretched with Argon2id and bound to a hardware key (Android Keystore, iOS Secure Enclave)
- 3 wrong PINs within an hour locks the app for an hour
- Optional biometric unlock. The PIN is still required every 72 hours, or after fingerprints or faces change
- Password generator with adjustable length and character sets
- Auto-lock when the app goes to the background or after 30 s to 5 min of inactivity
- Screenshot blocking on Android and a blurred app switcher preview on iOS
- Copied passwords are cleared from the clipboard after 30 seconds
- Encrypted backup export and restore, with the option to merge into or replace an existing vault
- Warning on rooted or jailbroken devices. Release builds refuse to unlock when a debugger is attached or the signature doesn't match

[SECURITY.md](SECURITY.md) describes the key hierarchy, backup format and known limitations.

## Tech stack

- Expo SDK 58, React Native 0.88, React 19, TypeScript
- `react-native-libsodium` for Argon2id
- A local Expo module, `modules/secure-native`, written in Kotlin and Swift. It handles hardware-bound keys, AES-GCM (JCA on Android, CryptoKit on iOS), sensitive clipboard writes, monotonic clock and integrity checks
- `expo-sqlite` for storage and `expo-secure-store` for device-only secrets and biometric keys
- A config plugin, `plugins/withHardenedAndroid.js`, that removes network permissions and disables Android backup

Navigation is a small state-based router in `App.tsx`. The app does not use Expo Router.

## Prerequisites

- Node.js. CI uses Node 24.
- For Android: the Android SDK and JDK 17. The minimum supported version is Android 9 (API 28).
- For iOS: macOS with Xcode.
- A development build. The app uses custom native modules, so it doesn't run in Expo Go.

## Getting started

```bash
npm install
npm run typecheck
npm test
```

### Development build

Metro talks to the app over the network, so a dev build has to keep the `INTERNET` permission. The `VAULT_DEV_NETWORK` flag tells the config plugin not to remove it:

```bash
# macOS / Linux
VAULT_DEV_NETWORK=1 npx expo prebuild --clean
npx expo run:android
```

```powershell
# Windows PowerShell
$env:VAULT_DEV_NETWORK = "1"; npx expo prebuild --clean
npx expo run:android
```

For iOS, use `npx expo run:ios` instead.

Run `npx expo prebuild --clean` again without the flag before you make a release build. Otherwise `INTERNET` stays in the generated manifest.

### Release build (Android)

```bash
npx expo prebuild --clean
npx expo run:android --variant release
```

Check that the APK requests no network permissions:

```bash
aapt2 dump permissions android/app/build/outputs/apk/release/app-release.apk
```

To turn on the signing certificate check, set `expo.extra.signingCertSha256` in `app.json` to the SHA-256 fingerprint of your release certificate. When it isn't set, the check is skipped.

## Testing

| Command | What it runs |
| --- | --- |
| `npm test` | Jest: unit, property-based, fuzz, golden-file and store contract tests |
| `npm run test:ci` | Same, with coverage thresholds enforced |
| `npm run lint` | ESLint via `expo lint` |
| `npm run mutation` | Stryker mutation testing (slow) |
| `swift test` in `modules/secure-native/ios` | CryptoKit AES-GCM against the shared test vectors (macOS only) |
| `./gradlew :secure-native:testDebugUnitTest` in `android/` | JCA AES-GCM against the shared test vectors |
| `./gradlew :secure-native:connectedDebugAndroidTest` in `android/` | Keystore device key on an emulator or phone |
| `maestro test .maestro` | End-to-end flows against an installed release build |

The Jest mocks in `__mocks__/` follow the real native contracts. They cover device-only secure storage, biometric cancel and invalidation, and hardware key failures. SQLite runs on `node:sqlite`, with disk failures injected. Tests run in random order and fail on any console output.

The Kotlin and Swift test vectors come from `modules/secure-native/test-vectors/aes-gcm.json`. After changing that file, regenerate them with:

```bash
npm run vectors
```

Regenerate the backup golden file only when the backup format version changes:

```bash
# macOS / Linux
UPDATE_FIXTURES=1 npx jest backupFixture
```

```powershell
# Windows PowerShell
$env:UPDATE_FIXTURES = "1"; npx jest backupFixture
```

### CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `master`:

- Typecheck, Jest with coverage, and checks that the license list and native test vectors are up to date
- Kotlin unit tests and a release APK build. The build fails if the APK requests a network permission, allows backup or is debuggable
- Instrumented Keystore tests and the Maestro flows on an API 34 emulator
- Swift tests on macOS

Mutation testing runs weekly and on manual dispatch.

## Maintenance scripts

| Command | When to run it |
| --- | --- |
| `npm run licenses` | After changing dependencies. Rebuilds `src/legal/licenses.json` for the Acknowledgements screen |
| `npm run assets` | After editing the SVGs in `assets/brand`. Regenerates the icon and splash PNGs |
| `npm run vectors` | After editing the shared AES-GCM test vectors |

CI fails if the license list or the test vectors are out of date.

## Moving to a new phone

1. On the old phone, open Settings, then Backup. Choose a backup password (at least 12 characters with three character types, or 20+ characters).
2. Save the `.enc` file to a folder or USB drive, or send it with Quick Share or Bluetooth.
3. On the new phone, choose **Restore from a backup**, select the file, enter the backup password and set a new PIN.

The backup is protected only by its password, with no device keys involved. The new phone creates its own hardware key during restore. If the new phone already has a vault, you can merge the backup into it or replace it.

There is no way to recover a forgotten PIN. If you forget it and don't have a backup, your data is gone.

## Project structure

```
App.tsx                 boot, routing between screens, auto-lock wiring
modules/secure-native   Kotlin/Swift module: hardware keys, AES-GCM, clipboard, integrity
plugins/                Android manifest hardening
scripts/                license list, asset and test vector generators
src/crypto              Argon2id, AES-GCM wrapper, password generator
src/vault               key wrapping, lockout, SQLite storage
src/backup              backup file format, password rules, file handling
src/security            auto-lock, clipboard, integrity checks
src/ui                  screens, components, theme
__tests__/              Jest tests
__mocks__/              native module mocks for Jest
.maestro/               end-to-end flows
```

## Security and privacy

See [SECURITY.md](SECURITY.md) for the threat model and how to report vulnerabilities, and [PRIVACY.md](PRIVACY.md) for the privacy policy.

## License

MIT. See [LICENSE](LICENSE).
