import { constantsControl } from '../__mocks__/expo-constants';
import { nativeControl } from '../__mocks__/secure-native';
import { checkIntegrity } from '../src/security/integrity';

const CERT = 'AB:CD:EF:01';

function setDev(v: boolean) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = v;
}

describe('integrity', () => {
  it('passes a clean release build', () => {
    expect(checkIntegrity()).toEqual({ blocked: null, warnings: [] });
  });

  it('blocks when a debugger is attached', () => {
    nativeControl.setIntegrity({ debuggerAttached: true });
    expect(checkIntegrity().blocked).toMatch(/debugger/i);
  });

  it('blocks a debuggable build', () => {
    nativeControl.setIntegrity({ debuggable: true });
    expect(checkIntegrity().blocked).toMatch(/debuggable/i);
  });

  it('accepts the expected signing certificate, case and whitespace insensitive', () => {
    constantsControl.setExtra({ signingCertSha256: ` ${CERT.toLowerCase()} ` });
    nativeControl.setIntegrity({ signingCertSha256: CERT });
    expect(checkIntegrity().blocked).toBeNull();
  });

  it.each([
    ['a different certificate', '00:11:22:33'],
    ['an unreadable certificate', null],
    ['multiple signers', 'multiple'],
  ])('blocks %s when a certificate is configured', (_label, actual) => {
    constantsControl.setExtra({ signingCertSha256: CERT });
    nativeControl.setIntegrity({ signingCertSha256: actual });
    expect(checkIntegrity().blocked).toMatch(/modified|re-signed/);
  });

  it('skips the certificate check on iOS', () => {
    constantsControl.setExtra({ signingCertSha256: CERT });
    nativeControl.setIntegrity({ platform: 'ios', signingCertSha256: null });
    expect(checkIntegrity().blocked).toBeNull();
  });

  it('only warns on rooted devices', () => {
    nativeControl.setIntegrity({ compromised: true });
    const v = checkIntegrity();
    expect(v.blocked).toBeNull();
    expect(v.warnings).toHaveLength(1);
  });

  it('never blocks in development, but still warns', () => {
    setDev(true);
    constantsControl.setExtra({ signingCertSha256: CERT });
    nativeControl.setIntegrity({ debuggerAttached: true, debuggable: true, compromised: true });
    const v = checkIntegrity();
    expect(v.blocked).toBeNull();
    expect(v.warnings).toHaveLength(1);
  });
});
