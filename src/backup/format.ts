import { DecryptError, open, seal } from '../crypto/aead';
import { concat, randomBytes, u32be, utf8Decode, utf8Encode, wipe } from '../crypto/bytes';
import { argon2id, assertSaneKdf, BACKUP_KDF, KdfParams, SALT_BYTES } from '../crypto/kdf';
import type { Entry } from '../vault/types';

/**
 * vault_backup.enc, fully self-contained (no device keys involved, so any phone can open it):
 *
 *   "OVBK" | ver u8 | kdf u8 | ops u32 | memKiB u32 | salt[16] | createdAt u64 | appVerLen u8 | appVer
 *   nonce[12] | AES-256-GCM(Argon2id(backupPassword, salt), JSON payload) | tag[16]
 *
 * The whole header is the AAD, so editing the date, version or KDF params breaks the tag.
 */

const MAGIC = utf8Encode('OVBK');
export const BACKUP_VERSION = 1;
const KDF_ARGON2ID13 = 2;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const BACKUP_EXTENSION = '.enc';
export const BACKUP_MIME = 'application/octet-stream';

export type BackupInfo = {
  version: number;
  createdAt: number;
  appVersion: string;
  kdf: KdfParams;
};

type Parsed = BackupInfo & { salt: Uint8Array; header: Uint8Array; body: Uint8Array };

export class BackupFormatError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BackupFormatError';
  }
}

export class WrongBackupPasswordError extends Error {
  constructor() {
    super('Wrong backup password, or the file was modified');
    this.name = 'WrongBackupPasswordError';
  }
}

export function backupFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `vault_backup_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${BACKUP_EXTENSION}`;
}

export function createBackup(
  entries: Entry[],
  password: string,
  opts: { appVersion: string; now?: number; kdf?: KdfParams },
): Uint8Array {
  const kdf = opts.kdf ?? BACKUP_KDF;
  const salt = randomBytes(SALT_BYTES);
  const appVer = utf8Encode(opts.appVersion).slice(0, 255);
  const created = opts.now ?? Date.now();
  const header = concat(
    MAGIC,
    Uint8Array.of(BACKUP_VERSION, KDF_ARGON2ID13),
    u32be(kdf.ops),
    u32be(kdf.memKiB),
    salt,
    u32be(Math.floor(created / 2 ** 32)),
    u32be(created % 2 ** 32),
    Uint8Array.of(appVer.length),
    appVer,
  );

  const pw = utf8Encode(password);
  const key = argon2id(pw, salt, kdf);
  const payload = utf8Encode(JSON.stringify({ v: 1, entries }));
  try {
    return concat(header, seal(key, payload, header));
  } finally {
    wipe(pw, key, payload);
  }
}

function parse(file: Uint8Array): Parsed {
  if (file.length > MAX_FILE_BYTES) throw new BackupFormatError('File is too large to be a backup');
  const fixed = 4 + 2 + 8 + SALT_BYTES + 8 + 1;
  if (file.length < fixed + 28) throw new BackupFormatError('Not a vault backup');
  for (let i = 0; i < 4; i++) {
    if (file[i] !== MAGIC[i]) throw new BackupFormatError('Not a vault backup');
  }
  const version = file[4];
  if (version !== BACKUP_VERSION) {
    throw new BackupFormatError(`Backup format v${version} is not supported by this app version`);
  }
  if (file[5] !== KDF_ARGON2ID13) throw new BackupFormatError('Unknown key-derivation method');

  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const kdf = { ops: dv.getUint32(6, false), memKiB: dv.getUint32(10, false) };
  try {
    assertSaneKdf(kdf);
  } catch {
    throw new BackupFormatError('Backup uses unsupported key-derivation parameters');
  }
  const salt = file.slice(14, 14 + SALT_BYTES);
  const createdAt = dv.getUint32(30, false) * 2 ** 32 + dv.getUint32(34, false);
  const appLen = file[38];
  const headerLen = fixed + appLen;
  if (file.length < headerLen + 28) throw new BackupFormatError('Backup file is truncated');
  const appVersion = utf8Decode(file.slice(39, 39 + appLen));
  return {
    version,
    kdf,
    salt,
    createdAt,
    appVersion,
    header: file.slice(0, headerLen),
    body: file.slice(headerLen),
  };
}

/** Readable without the password: date and version, so you can pick the right file. */
export function readBackupInfo(file: Uint8Array): BackupInfo {
  const { version, createdAt, appVersion, kdf } = parse(file);
  return { version, createdAt, appVersion, kdf };
}

/** Decrypts and fully validates. Nothing touches the live vault until this returns. */
export function openBackup(file: Uint8Array, password: string): { info: BackupInfo; entries: Entry[] } {
  const p = parse(file);
  const pw = utf8Encode(password);
  const key = argon2id(pw, p.salt, p.kdf);
  let plain: Uint8Array;
  try {
    plain = open(key, p.body, p.header);
  } catch (e) {
    if (e instanceof DecryptError) throw new WrongBackupPasswordError();
    throw e;
  } finally {
    wipe(pw, key);
  }
  try {
    const json = JSON.parse(utf8Decode(plain));
    if (!json || json.v !== 1 || !Array.isArray(json.entries)) {
      throw new BackupFormatError('Backup contents are malformed');
    }
    const entries = (json.entries as unknown[]).map(validateEntry);
    const ids = new Set(entries.map((e) => e.id));
    if (ids.size !== entries.length) throw new BackupFormatError('Backup has duplicate entries');
    return {
      info: { version: p.version, createdAt: p.createdAt, appVersion: p.appVersion, kdf: p.kdf },
      entries,
    };
  } finally {
    wipe(plain);
  }
}

function validateEntry(x: unknown): Entry {
  const e = x as Record<string, unknown>;
  const str = (k: string, max: number) => {
    const v = e?.[k];
    if (typeof v !== 'string' || v.length > max) throw new BackupFormatError('Backup contents are malformed');
    return v;
  };
  const num = (k: string) => {
    const v = e?.[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new BackupFormatError('Backup contents are malformed');
    return v;
  };
  const id = str('id', 64);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new BackupFormatError('Backup contents are malformed');
  return {
    id,
    title: str('title', 200),
    username: str('username', 500),
    url: str('url', 2000),
    password: str('password', 1000),
    notes: str('notes', 10000),
    createdAt: num('createdAt'),
    updatedAt: num('updatedAt'),
  };
}
