/**
 * Driver selector.
 *
 * The services are written against one small facade - prepare/get/all/run,
 * transaction, resetSchema - so the same code runs on either backend.
 *
 * An explicit DB_DRIVER always wins. Previously the presence of DATABASE_URL
 * alone forced Postgres, which meant DB_DRIVER=sqlite was silently ignored
 * whenever a Supabase URL happened to be in the environment - and the test
 * suite, which calls /api/demo/reset, then dropped the real database. With no
 * explicit driver, a DATABASE_URL still selects Postgres.
 */
const requested = String(process.env.DB_DRIVER || '').trim().toLowerCase();
const usePostgres = requested ? requested === 'postgres' : Boolean(process.env.DATABASE_URL);

let impl;
if (usePostgres) {
  impl = await import('./postgres.js');
} else {
  impl = await import('./sqlite.js');
}

export const DRIVER = usePostgres ? 'postgres' : 'sqlite';
export const LEDGER_ORDER = impl.LEDGER_ORDER ?? 'rowid';
export const db = impl.db;
export const transaction = impl.transaction;
export const resetSchema = impl.resetSchema;
export const applySchema = impl.applySchema ?? (() => {});
export const DB_PATH = impl.DB_PATH ?? null;
export const closePool = impl.closePool ?? (() => {});

export default db;
