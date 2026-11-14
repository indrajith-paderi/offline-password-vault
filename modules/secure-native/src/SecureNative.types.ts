export type IntegrityReport = {
  platform: 'android' | 'ios';
  debuggerAttached: boolean;
  debuggable: boolean;
  compromised: boolean;
  signingCertSha256: string | null;
  installer: string | null;
};

export type DeviceKeyLevel = 'strongbox' | 'tee' | 'software' | 'secure_enclave' | 'keychain';

export interface SecureNativeModule {
  deviceMac(data: Uint8Array): Promise<Uint8Array>;
  deviceKeySecurityLevel(): Promise<DeviceKeyLevel>;
  deleteDeviceKey(): Promise<void>;
  aesGcmEncrypt(key: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array;
  aesGcmDecrypt(key: Uint8Array, blob: Uint8Array, aad: Uint8Array): Uint8Array;
  monotonicMs(): number;
  bootId(): string;
  copySensitive(text: string, expiresInMs: number): Promise<void>;
  clearClipboard(): Promise<void>;
  integrityReport(): IntegrityReport;
}
