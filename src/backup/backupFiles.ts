import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomBytes } from '../crypto/bytes';
import { BACKUP_MIME } from './format';

/**
 * File plumbing for backups. Nothing here ever uploads anything: the user picks a folder
 * (internal storage, SD card, USB-OTG drive) or hands the file to the system share sheet
 * for Quick Share / Bluetooth / USB transfer.
 */

/** Save into a user-chosen folder via the system picker (works with USB-OTG drives). */
export async function saveBackupToFolder(bytes: Uint8Array, name: string): Promise<string | null> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return null; // cancelled
  }
  const file = dir.createFile(name, BACKUP_MIME);
  await file.write(bytes);
  return file.uri;
}

/**
 * Hand the file to the share sheet. It's already encrypted, but the share sheet also lists
 * cloud apps: the UI warns the user to pick an offline target.
 */
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

/**
 * Overwrite then delete. On flash storage with wear levelling this is best-effort only;
 * the real protection is that the file was encrypted to begin with.
 */
async function scrubAndDelete(f: File): Promise<void> {
  try {
    const size = f.size ?? 0;
    if (size > 0) await f.write(randomBytes(size));
  } catch {
    // fall through to delete
  }
  if (f.exists) f.delete();
}
