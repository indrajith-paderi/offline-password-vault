module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, isolatedModules: true, module: 'preserve', target: 'es2022', moduleResolution: 'bundler', rootDir: '.', types: ['jest', 'node'] } }],
  },
  moduleNameMapper: {
    '^react-native-libsodium$': '<rootDir>/__mocks__/libsodium.ts',
    '.*/modules/secure-native$': '<rootDir>/__mocks__/secure-native.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testMatch: ['**/*.test.ts'],
};
