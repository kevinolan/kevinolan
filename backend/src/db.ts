/**
 * SQLite data layer backed by sql.js (pure-WASM SQLite — no native build needed).
 *
 * The same module is used by the running server (persists to `data/fluentpath.db`)
 * and by tests (in-memory, never persisted). Schema is created on open.
 *
 * Why sql.js over better-sqlite3: this environment (Windows / git-bash) has no
 * reliable node-gyp toolchain for native modules; sql.js is WASM-only and runs
 * identically on every platform. Swap to better-sqlite3 later with no API change
 * outside this file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'fluentpath.db');
const WASM_DIR = path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm'));
// sql.js calls locateFile('sql-wasm.wasm') and expects the full path back.
const locateFile = (file: string) => path.join(WASM_DIR, file);

let sqlPromise: Promise<SqlJsStatic> | null = null;
function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile });
  }
  return sqlPromise as Promise<SqlJsStatic>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client','clinician')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  p_stutter REAL,                 -- nullable
  repetitions INTEGER NOT NULL,
  prolongations INTEGER NOT NULL,
  blocks INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  rate_per_min REAL NOT NULL,
  disfluencies INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_user ON metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON metrics(recorded_at);
`;

export interface DbHandle {
  db: Database;
  /** Persist to disk (no-op for in-memory handles). */
  persist: () => void;
  /** Drop all rows (tests + db:reset). */
  clear: () => void;
  close: () => void;
}

/** Open a persisted DB (creates the file + schema if missing). */
export async function openDb(dbPath: string = DB_PATH): Promise<DbHandle> {
  const SQL = await getSql();
  let db: Database;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);

  const persist = () => {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const bytes = db.export();
    fs.writeFileSync(dbPath, Buffer.from(bytes));
  };

  return {
    db,
    persist,
    clear: () => {
      db.run('DELETE FROM metrics; DELETE FROM users;');
    },
    close: () => db.close(),
  };
}

/** Open an in-memory DB (tests). Nothing is written to disk. */
export async function openMemoryDb(): Promise<DbHandle> {
  const SQL = await getSql();
  const db = new SQL.Database();
  db.run(SCHEMA);
  return {
    db,
    persist: () => {},
    clear: () => {
      db.run('DELETE FROM metrics; DELETE FROM users;');
    },
    close: () => db.close(),
  };
}
