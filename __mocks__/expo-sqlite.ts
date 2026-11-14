import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null | Uint8Array;

function norm(params: unknown[]): Param[] {
  const flat = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return flat.map((p) => {
    if (p === null || typeof p === 'string' || typeof p === 'number' || p instanceof Uint8Array) return p;
    throw new TypeError(`Unsupported SQLite parameter: ${typeof p}`);
  });
}

function plain<T>(row: unknown): T {
  if (!row) return row as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) out[k] = v;
  return out as T;
}

const files = new Map<string, DatabaseSync>();
let failAfterRuns: number | null = null;
let runs = 0;
let openTx = 0;

export class SQLiteDatabase {
  constructor(private db: DatabaseSync) {}

  private tick() {
    runs += 1;
    if (failAfterRuns !== null && runs > failAfterRuns) {
      failAfterRuns = null;
      throw new Error('SQLITE_IOERR: simulated disk failure');
    }
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]) {
    this.tick();
    const r = this.db.prepare(sql).run(...norm(params));
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    return plain<T>(this.db.prepare(sql).get(...norm(params))) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...norm(params)).map((r) => plain<T>(r));
  }

  async withExclusiveTransactionAsync(fn: (tx: SQLiteDatabase) => Promise<void>): Promise<void> {
    if (openTx > 0) throw new Error('Nested exclusive transaction');
    openTx += 1;
    this.db.exec('BEGIN EXCLUSIVE');
    try {
      await fn(this);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    } finally {
      openTx -= 1;
    }
  }
}

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  let db = files.get(name);
  if (!db) {
    db = new DatabaseSync(':memory:');
    files.set(name, db);
  }
  return new SQLiteDatabase(db);
}

export const sqliteControl = {
  reset() {
    for (const db of files.values()) db.close();
    files.clear();
    failAfterRuns = null;
    runs = 0;
    openTx = 0;
  },
  failAfter(n: number) {
    runs = 0;
    failAfterRuns = n;
  },
  raw(name: string): DatabaseSync | undefined {
    return files.get(name);
  },
};
