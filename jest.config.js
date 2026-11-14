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
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/*.test.ts'],
  randomize: true,
  restoreMocks: true,
  clearMocks: true,
  errorOnDeprecated: true,
  testTimeout: 30000,
};
