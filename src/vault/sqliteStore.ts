import * as SQLite from 'expo-sqlite';
import type { VaultStore } from './store';
import type { EncryptedRow } from './types';

const DB_NAME = 'vault.db';

type RowRecord = { id: string; summary: Uint8Array; secret: Uint8Array };

export class SqliteStore implements VaultStore {
  private constructor(private db: SQLite.SQLiteDatabase) {}

  static async open(): Promise<SqliteStore> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = DELETE;
      PRAGMA secure_delete = ON;
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY NOT NULL, v BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY NOT NULL,
        summary BLOB NOT NULL,
        secret BLOB NOT NULL
      );
    `);
    return new SqliteStore(db);
  }

  async getMeta(k: string) {
    const r = await this.db.getFirstAsync<{ v: Uint8Array }>('SELECT v FROM meta WHERE k = ?', k);
    return r ? new Uint8Array(r.v) : null;
  }

  async setMeta(e: Record<string, Uint8Array>) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      for (const [k, v] of Object.entries(e)) {
        await tx.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', k, v);
      }
    });
  }

  async listRows(): Promise<EncryptedRow[]> {
    const rows = await this.db.getAllAsync<RowRecord>('SELECT id, summary, secret FROM entries');
    return rows.map(toRow);
  }

  async getRow(id: string) {
    const r = await this.db.getFirstAsync<RowRecord>(
      'SELECT id, summary, secret FROM entries WHERE id = ?',
      id,
    );
    return r ? toRow(r) : null;
  }

  async putRow(r: EncryptedRow) {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO entries (id, summary, secret) VALUES (?, ?, ?)',
      r.id,
      r.summary,
      r.secret,
    );
  }

  async deleteRow(id: string) {
    await this.db.runAsync('DELETE FROM entries WHERE id = ?', id);
  }

  async replaceAll(meta: Record<string, Uint8Array>, rows: EncryptedRow[]) {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM entries');
      await tx.runAsync('DELETE FROM meta');
      for (const [k, v] of Object.entries(meta)) {
        await tx.runAsync('INSERT INTO meta (k, v) VALUES (?, ?)', k, v);
      }
      for (const r of rows) {
        await tx.runAsync(
          'INSERT INTO entries (id, summary, secret) VALUES (?, ?, ?)',
          r.id,
          r.summary,
          r.secret,
        );
      }
    });
  }

  async wipe() {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM entries');
      await tx.runAsync('DELETE FROM meta');
    });
    await this.db.execAsync('VACUUM');
  }
}

function toRow(r: RowRecord): EncryptedRow {
  return { id: r.id, summary: new Uint8Array(r.summary), secret: new Uint8Array(r.secret) };
}
