import sodium from 'react-native-libsodium';

beforeAll(async () => {
  await sodium.ready;
});
