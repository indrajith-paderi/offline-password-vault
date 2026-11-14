import sodium from 'react-native-libsodium';
import { constantsControl } from '../__mocks__/expo-constants';
import { secureStoreControl } from '../__mocks__/expo-secure-store';
import { nativeControl } from '../__mocks__/secure-native';

const CONSOLE_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;

beforeAll(async () => {
  await sodium.ready;
});

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  constantsControl.reset();
  nativeControl.reset();
  secureStoreControl.reset();
  for (const m of CONSOLE_METHODS) {
    jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      throw new Error(`Unexpected console.${m}: ${args.map(String).join(' ')}`);
    });
  }
});

afterEach(() => {
  jest.useRealTimers();
});
