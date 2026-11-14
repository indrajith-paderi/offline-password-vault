import fs from 'fs';
import path from 'path';
import { createBackup, openBackup, readBackupInfo, WrongBackupPasswordError } from '../src/backup/format';
import type { Entry } from '../src/vault/types';
import { FAST_KDF } from './helpers';

const FIXTURE = path.join(__dirname, 'fixtures', 'backup-v1.enc');
const PASSWORD = 'Fixture-Passw0rd!';
const CREATED_AT = 1_763_000_000_000;

const ENTRIES: Entry[] = [
  {
    id: 'a1b2c3',
    title: 'Bank',
    username: 'me@example.com',
    url: 'https://bank.example',
    password: 'correct horse battery staple',
    notes: 'line one\nline two',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
  },
  {
    id: 'unicode_1',
    title: 'Café 🔐 日本',
    username: '',
    url: '',
    password: 'pässwörd-𝔘𝔫𝔦𝔠𝔬𝔡𝔢',
    notes: '',
    createdAt: 1,
    updatedAt: 2,
  },
];

describe('backup v1 golden file', () => {
  if (process.env.UPDATE_FIXTURES === '1') {
    it('regenerates the fixture', () => {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, createBackup(ENTRIES, PASSWORD, { appVersion: '1.0.0', now: CREATED_AT, kdf: FAST_KDF }));
    });
    return;
  }

  const file = () => new Uint8Array(fs.readFileSync(FIXTURE));

  it('still reads the header', () => {
    expect(readBackupInfo(file())).toEqual({ version: 1, createdAt: CREATED_AT, appVersion: '1.0.0', kdf: FAST_KDF });
  });

  it('still decrypts to the exact original entries', () => {
    expect(openBackup(file(), PASSWORD).entries).toEqual(ENTRIES);
  });

  it('still rejects the wrong password', () => {
    expect(() => openBackup(file(), PASSWORD.toLowerCase())).toThrow(WrongBackupPasswordError);
  });

  it('starts with the OVBK magic', () => {
    expect(Buffer.from(file().subarray(0, 4)).toString('latin1')).toBe('OVBK');
  });
});
