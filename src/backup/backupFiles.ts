import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomBytes } from '../crypto/bytes';
import { BACKUP_MIME } from './format';

export async function saveBackupToFolder(bytes: Uint8Array, name: string): Promise<string | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null;
  }
  const file = dir.createFile(name, BACKUP_MIME);
  await file.write(bytes);
  return file.uri;
}

export async function shareBackup(bytes: Uint8Array, name: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available');
  const tmp = new File(Paths.cache, name);
  if (tmp.exists) tmp.delete();
  tmp.create();
  await tmp.write(bytes);
  try {
    await Sharing.shareAsync(tmp.uri, { mimeType: BACKUP_MIME, dialogTitle: 'Send encrypted backup' });
  } finally {
    await scrubAndDelete(tmp);
  }
}

export async function pickBackupFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const res = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (res.canceled) return null;
  return { name: res.result.name, bytes: await res.result.bytes() };
}

async function scrubAndDelete(f: File): Promise<void> {
  try {
    const size = f.size ?? 0;
    if (size > 0) await f.write(randomBytes(size));
  } catch {
  }
  if (f.exists) f.delete();
}
