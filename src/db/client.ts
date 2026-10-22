import DatabaseConstructor, { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface D1ExecResult {
  success: boolean;
  meta: {
    changes: number;
    last_row_id: number;
  };
}

export interface D1AllQueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
}

export interface ID1PreparedStatement {
  bind(...values: unknown[]): ID1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllQueryResult<T>>;
  run(): Promise<D1ExecResult>;
}

export interface ID1Database {
  prepare(query: string): ID1PreparedStatement;
  exec(query: string): Promise<void>;
}

/**
 * Local SQLite Adapter simulating Cloudflare Workers D1 Database API
 */
class LocalD1Database implements ID1Database {
  private db: BetterSqliteDatabase;

  constructor(dbPath: string = 'catalog.local.db') {
    this.db = new DatabaseConstructor(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    const schemaPaths = [
      resolve(process.cwd(), 'schema.sql'),
      resolve(process.cwd(), 'edge-commerce-sync', 'schema.sql'),
      resolve(import.meta.dirname ?? '.', '../../schema.sql'),
    ];

    for (const p of schemaPaths) {
      if (existsSync(p)) {
        const sql = readFileSync(p, 'utf-8');
        this.db.exec(sql);
        break;
      }
    }
  }

  prepare(query: string): ID1PreparedStatement {
    const stmt = this.db.prepare(query);

    return {
      bind(...values: unknown[]) {
        let boundValues = values;
        return {
          bind(...newValues: unknown[]) {
            boundValues = newValues;
            return this;
          },
          async first<T = Record<string, unknown>>(): Promise<T | null> {
            const row = stmt.get(...boundValues) as T | undefined;
            return row ?? null;
          },
          async all<T = Record<string, unknown>>(): Promise<D1AllQueryResult<T>> {
            const rows = stmt.all(...boundValues) as T[];
            return { results: rows, success: true };
          },
          async run(): Promise<D1ExecResult> {
            const info = stmt.run(...boundValues);
            return {
              success: true,
              meta: {
                changes: info.changes,
                last_row_id: Number(info.lastInsertRowid),
              },
            };
          },
        };
      },
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        const row = stmt.get() as T | undefined;
        return row ?? null;
      },
      async all<T = Record<string, unknown>>(): Promise<D1AllQueryResult<T>> {
        const rows = stmt.all() as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<D1ExecResult> {
        const info = stmt.run();
        return {
          success: true,
          meta: {
            changes: info.changes,
            last_row_id: Number(info.lastInsertRowid),
          },
        };
      },
    };
  }

  async exec(query: string): Promise<void> {
    this.db.exec(query);
  }

  getNativeDb(): BetterSqliteDatabase {
    return this.db;
  }
}

let localDbInstance: LocalD1Database | null = null;

export function getDatabase(d1Binding?: unknown): ID1Database {
  if (d1Binding && typeof (d1Binding as ID1Database).prepare === 'function') {
    return d1Binding as ID1Database;
  }

  if (!localDbInstance) {
    localDbInstance = new LocalD1Database();
  }
  return localDbInstance;
}

export function resetLocalDatabase(inMemory: boolean = false): ID1Database {
  localDbInstance = new LocalD1Database(inMemory ? ':memory:' : 'catalog.local.db');
  return localDbInstance;
}
