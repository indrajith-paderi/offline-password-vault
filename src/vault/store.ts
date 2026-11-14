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

const copyRow = (r: EncryptedRow): EncryptedRow => ({ id: r.id, summary: r.summary.slice(), secret: r.secret.slice() });

export class MemoryStore implements VaultStore {
  meta = new Map<string, Uint8Array>();
  rows = new Map<string, EncryptedRow>();
  async getMeta(k: string) {
    return this.meta.get(k)?.slice() ?? null;
  }
  async setMeta(e: Record<string, Uint8Array>) {
    for (const [k, v] of Object.entries(e)) this.meta.set(k, v.slice());
  }
  async listRows() {
    return [...this.rows.values()].map(copyRow);
  }
  async getRow(id: string) {
    const r = this.rows.get(id);
    return r ? copyRow(r) : null;
  }
  async putRow(r: EncryptedRow) {
    this.rows.set(r.id, copyRow(r));
  }
  async deleteRow(id: string) {
    this.rows.delete(id);
  }
  async replaceAll(meta: Record<string, Uint8Array>, rows: EncryptedRow[]) {
    this.meta = new Map(Object.entries(meta).map(([k, v]) => [k, v.slice()]));
    this.rows = new Map(rows.map((r) => [r.id, copyRow(r)]));
  }
  async wipe() {
    this.meta.clear();
    this.rows.clear();
  }
}
