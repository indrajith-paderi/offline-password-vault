const tsJest = [
  'ts-jest',
  {
    tsconfig: {
      strict: true,
      esModuleInterop: true,
      isolatedModules: true,
      module: 'preserve',
      target: 'es2022',
      moduleResolution: 'bundler',
      rootDir: '.',
      resolveJsonModule: true,
      types: ['jest', 'node'],
    },
  },
];

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: { '^.+\.tsx?$': tsJest },
  moduleNameMapper: {
    '^react-native-libsodium$': '<rootDir>/__mocks__/libsodium.ts',
    '.*/modules/secure-native$': '<rootDir>/__mocks__/secure-native.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/*.test.ts'],
  randomize: true,
  restoreMocks: true,
  clearMocks: true,
  errorOnDeprecated: true,
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/crypto/**/*.ts',
    'src/vault/**/*.ts',
    'src/backup/format.ts',
    'src/backup/passwordPolicy.ts',
    'src/security/idleLocker.ts',
    'src/security/clipboard.ts',
    'src/security/integrity.ts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 95, branches: 90, functions: 95, lines: 95 },
    './src/crypto/': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/backup/format.ts': { statements: 98, branches: 95, functions: 100, lines: 98 },
    './src/vault/lockout.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
    './src/vault/keys.ts': { statements: 100, branches: 95, functions: 100, lines: 100 },
  },
};
