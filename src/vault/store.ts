import type { EncryptedRow } from './types';

export interface VaultStore {
  getMeta(key: string): Promise<Uint8Array | null>;
  setMeta(entries: Record<string, Uint8Array>): Promise<void>;
  listRows(): Promise<EncryptedRow[]>;
  getRow(id: string): Promise<EncryptedRow | null>;
  putRow(row: EncryptedRow): Promise<void>;
  deleteRow(id: string): Promise<void>;
  replaceAll(meta: Record<string, Uint8Array>, rows: EncryptedRow[]): Promise<void>;
  wipe(): Promise<void>;
}

export class MemoryStore implements VaultStore {
  meta = new Map<string, Uint8Array>();
  rows = new Map<string, EncryptedRow>();
  async getMeta(k: string) {
    return this.meta.get(k) ?? null;
  }
  async setMeta(e: Record<string, Uint8Array>) {
    for (const [k, v] of Object.entries(e)) this.meta.set(k, v);
  }
  async listRows() {
    return [...this.rows.values()];
  }
  async getRow(id: string) {
    return this.rows.get(id) ?? null;
  }
  async putRow(r: EncryptedRow) {
    this.rows.set(r.id, r);
  }
  async deleteRow(id: string) {
    this.rows.delete(id);
  }
  async replaceAll(meta: Record<string, Uint8Array>, rows: EncryptedRow[]) {
    this.meta = new Map(Object.entries(meta));
    this.rows = new Map(rows.map((r) => [r.id, r]));
  }
  async wipe() {
    this.meta.clear();
    this.rows.clear();
  }
}
