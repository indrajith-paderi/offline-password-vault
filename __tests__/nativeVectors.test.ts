import fs from 'fs';

const { render } = require('../scripts/generate-native-vectors') as { render: () => Record<string, string> };

describe('native test vectors', () => {
  it.each(Object.entries(render()))('%s is in sync with aes-gcm.json', (file, expected) => {
    expect(fs.readFileSync(file, 'utf8')).toBe(expected);
  });
});
