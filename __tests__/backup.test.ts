import { secureStoreControl } from '../__mocks__/expo-secure-store';
import { nativeControl } from '../__mocks__/secure-native';
import {
  BackupFormatError,
  createBackup,
  openBackup,
  readBackupInfo,
  WrongBackupPasswordError,
} from '../src/backup/format';
import { backupPasswordProblem } from '../src/backup/passwordPolicy';
import { MemoryStore } from '../src/vault/store';
import { Vault } from '../src/vault/vault';

const FAST = { ops: 2, memKiB: 19 * 1024 };
const PW = 'Tr0ub4dor&3-but-longer';
const entries = [
  {
    id: 'a1',
    title: 'Mail',
    username: 'me',
    url: '',
    password: 's3cret🔑',
    notes: '',
    createdAt: 1,
    updatedAt: 2,
  },
];

describe('backup format', () => {
  it('round-trips and exposes date/version without the password', () => {
    const file = createBackup(entries, PW, { appVersion: '1.0.0', now: 1_700_000_000_123, kdf: FAST });
    expect(readBackupInfo(file)).toMatchObject({ createdAt: 1_700_000_000_123, appVersion: '1.0.0', version: 1 });
    expect(openBackup(file, PW).entries).toEqual(entries);
    expect(Buffer.from(file).toString('latin1')).not.toContain('s3cret');
  });

  it('uses a fresh salt and nonce every time', () => {
    const a = createBackup(entries, PW, { appVersion: '1', now: 1, kdf: FAST });
    const b = createBackup(entries, PW, { appVersion: '1', now: 1, kdf: FAST });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects a wrong password', () => {
    const file = createBackup(entries, PW, { appVersion: '1', kdf: FAST });
    expect(() => openBackup(file, PW + 'x')).toThrow(WrongBackupPasswordError);
  });

  it('detects tampering with the header (e.g. a faked date)', () => {
    const file = createBackup(entries, PW, { appVersion: '1', now: 5, kdf: FAST });
    file[37] ^= 1;
    expect(() => openBackup(file, PW)).toThrow(WrongBackupPasswordError);
  });

  it('detects corruption in the body', () => {
    const file = createBackup(entries, PW, { appVersion: '1', kdf: FAST });
    file[file.length - 20] ^= 0xff;
    expect(() => openBackup(file, PW)).toThrow(WrongBackupPasswordError);
  });

  it('rejects junk and hostile KDF params before doing any work', () => {
    expect(() => readBackupInfo(new Uint8Array(100))).toThrow(BackupFormatError);
    const file = createBackup(entries, PW, { appVersion: '1', kdf: FAST });
    new DataView(file.buffer).setUint32(10, 0xffffffff);
    expect(() => readBackupInfo(file)).toThrow(BackupFormatError);
  });
});

describe('phone migration', () => {
  it('restores on a new phone with new device keys and a new PIN', async () => {
    const clock = () => ({ wall: Date.now(), mono: 1, boot: 'b' });
    const oldPhone = new Vault(new MemoryStore(), clock, FAST);
    await oldPhone.create('1357');
    await oldPhone.save({ title: 'Bank', username: 'u', url: '', password: 'p@ss', notes: '' });
    const file = createBackup(await oldPhone.exportAll(), PW, { appVersion: '1', kdf: FAST });

    secureStoreControl.wipe();
    nativeControl.newDevice();
    const { entries: restored } = openBackup(file, PW);
    const newPhone = new Vault(new MemoryStore(), clock, FAST);
    await newPhone.create('2468', restored);
    newPhone.lock();
    expect((await newPhone.unlockWithPin('2468')).ok).toBe(true);
    const [bank] = await newPhone.list();
    expect((await newPhone.getSecret(bank.id)).password).toBe('p@ss');
  });
});

describe('backup password policy', () => {
  it.each([
    ['short1A!', false],
    ['alllowercaseletters', false],
    ['Password123!xyz', false],
    ['aaaaaaaaaaaaaaaaaaaaaa', false],
    ['Blue-Kettle-91-Orbit', true],
    ['correct horse battery staple', true],
  ])('%s -> ok=%s', (pw, ok) => {
    expect(backupPasswordProblem(pw) === null).toBe(ok);
  });
});
