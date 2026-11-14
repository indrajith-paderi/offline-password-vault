import Constants from 'expo-constants';
import SecureNative from '../../modules/secure-native';

export type IntegrityVerdict = {
  /** Hard stop: the app refuses to unlock. */
  blocked: string | null;
  /** Shown to the user, but they decide. */
  warnings: string[];
};

/**
 * Tamper checks. None of these are bulletproof on a device the attacker fully controls;
 * they catch repackaged APKs and casual debugging, and tell you when your phone is rooted.
 *
 * Set `extra.signingCertSha256` in app.json to your release certificate's SHA-256
 * (colon-separated, upper case) to make a re-signed APK refuse to open the vault.
 */
export function checkIntegrity(): IntegrityVerdict {
  const r = SecureNative.integrityReport();
  const warnings: string[] = [];
  let blocked: string | null = null;

  if (!__DEV__) {
    if (r.debuggerAttached) blocked = 'A debugger is attached to the app.';
    if (r.debuggable) blocked = 'This build is debuggable. Install a release build.';
    const expected = Constants.expoConfig?.extra?.signingCertSha256 as string | undefined;
    if (expected && r.signingCertSha256 && r.signingCertSha256 !== expected.toUpperCase()) {
      blocked = 'This copy of the app has been modified or re-signed.';
    }
  }
  if (r.compromised) {
    warnings.push(
      'This device appears to be rooted or jailbroken. Other apps may be able to read the vault while it is unlocked.',
    );
  }
  return { blocked, warnings };
}
