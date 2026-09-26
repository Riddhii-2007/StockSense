import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

export const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'stocksense.db');
export const DRIVER = 'sqlite';
// SQLite's implicit rowid is a monotonic counter in insertion order, which is
// exactly what the ledger audit chain needs to replay in. The PostgreSQL driver
// uses a real sequence instead; see migrate.supabase.sql for why neither
// created_at nor the uuid primary key can be trusted for this.
export const LEDGER_ORDER = 'rowid';
const SCHEMA_PATH = path.join(here, 'schema.sql');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Positional (?, ?, ...) parameters only. Named-parameter binding differs
// across node:sqlite versions; positional binding is stable.

/**
 * Run fn inside a transaction. Rolls back on any throw, so a rejected
 * operation can never leave a partial ledger behind.
 */
export async function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    // Must be awaited. The service layer is async, so without this the COMMIT
    // below would fire while the transaction body is still suspended, and the
    // whole atomicity guarantee quietly evaporates.
    const result = await fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // rollback of an already-aborted transaction is not itself an error
    }
    throw err;
  }
}

/** Drop every table (and therefore every trigger) and rebuild from schema. */
export async function resetSchema() {
  db.exec('PRAGMA foreign_keys = OFF');
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    .all();
  for (const { name } of tables) {
    db.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

export default db;
