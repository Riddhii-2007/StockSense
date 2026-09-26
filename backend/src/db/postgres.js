import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// NUMERIC and INT8 come back as strings by default so precision is never
// silently lost. Every place the app reads them is a comparison or a display,
// so parse them here rather than sprinkling Number() through the services.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Supabase's pooler does not support prepared statements across sessions.
  ...(String(process.env.DATABASE_URL).includes('pooler.supabase.com') ? { query_timeout: 15_000 } : {}),
});

// Routes every query inside a transaction back to that transaction's client.
// Without this, BEGIN could land on one pooled connection and the next
// statement on another, which silently breaks atomicity.
const clientStore = new AsyncLocalStorage();

/**
 * Rewrite `?` placeholders to $1..$n, skipping any `?` inside a string
 * literal. The services are written with positional `?` so the same source
 * runs on either driver.
 */
function toDollarPlaceholders(sql) {
  let out = '';
  let index = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (ch === "'") {
      // Handle the doubled '' escape so 'it''s ?' is not miscounted.
      if (inString && sql[i + 1] === "'") {
        out += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      out += ch;
      continue;
    }
    if (ch === '?' && !inString) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function currentClient() {
  return clientStore.getStore() ?? null;
}

async function query(sql, params = []) {
  const client = currentClient();
  const text = toDollarPlaceholders(sql);
  if (client) return client.query(text, params);
  return pool.query(text, params);
}

/**
 * SQLite-shaped facade over pg, so services/engine.js, services/validation.js,
 * services/integrity.js and every route stay byte-identical across drivers.
 */
function prepare(sql) {
  const wantsRow = /\bRETURNING\b/i.test(sql);
  return {
    async run(...params) {
      const res = await query(sql, params);
      return {
        changes: res.rowCount ?? 0,
        rowCount: res.rowCount ?? 0,
        lastInsertRowid: wantsRow && res.rows?.[0] ? res.rows[0].id : undefined,
      };
    },
    async get(...params) {
      const res = await query(sql, params);
      return res.rows?.[0];
    },
    async all(...params) {
      const res = await query(sql, params);
      return res.rows ?? [];
    },
  };
}

export const db = { prepare, exec: async (sql) => { await query(sql); } };

/** Run fn inside a transaction, pinned to one client for its whole duration. */
export function transaction(fn) {
  return (async () => {
    const existing = currentClient();
    if (existing) return fn(existing); // already inside one: join it
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await clientStore.run(client, () => fn(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // connection already broken; the pool will discard it
      }
      throw err;
    } finally {
      client.release();
    }
  })();
}

// The migration is idempotent (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT
// EXISTS / DO-guarded constraints), so it is safe to run on every boot and safe
// to run on top of the team's already-created tables. It is also the file to
// paste into the Supabase SQL Editor when no database password is available.
//
// This is the same file that was applied to the live project, so booting the
// app against Supabase replays exactly the migration that is already there.
const SCHEMA = path.join(here, 'migrate.supabase.sql');

export const DRIVER = 'postgres';
// Monotonic insertion order for the ledger audit chain. See migrate.supabase.sql
// for why created_at and the uuid primary key cannot be used for this.
export const LEDGER_ORDER = 'seq';

export async function applySchema() {
  const sql = fs.readFileSync(SCHEMA, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * resetSchema drops every table. That is fine for a throwaway SQLite file and
 * catastrophic for a shared cloud database, so it is refused for any remote host
 * unless the operator opts in explicitly with ALLOW_DESTRUCTIVE_RESET=true.
 *
 * This guard exists because the test suite calls /api/demo/reset on boot: a
 * misconfigured DB_DRIVER once pointed that reset at the team's live Supabase
 * project and dropped it. A reset must never be a side effect of running tests.
 */
function assertResetAllowed() {
  let host = '';
  try {
    host = new URL(String(process.env.DATABASE_URL)).hostname;
  } catch {
    host = '';
  }
  if (LOCAL_HOSTS.has(host)) return;
  if (String(process.env.ALLOW_DESTRUCTIVE_RESET).toLowerCase() === 'true') return;
  const err = new Error(
    `Refusing to drop tables on remote database "${host || 'unknown'}". ` +
      'resetSchema is only allowed on localhost, or with ALLOW_DESTRUCTIVE_RESET=true.'
  );
  err.status = 409;
  throw err;
}

export async function resetSchema() {
  assertResetAllowed();
  // Order matters only for readability; CASCADE handles the dependencies.
  // sync_stock_on_* triggers live on stock_by_location and are dropped with it.
  await db.exec(`
    DROP TABLE IF EXISTS stock_ledger, operation_items, operations,
                         stock_by_location, products, locations, users CASCADE;
    DROP FUNCTION IF EXISTS forbid_ledger_mutation() CASCADE;
    DROP FUNCTION IF EXISTS forbid_posted_item_mutation() CASCADE;
    DROP FUNCTION IF EXISTS sync_product_current_stock() CASCADE;
  `);
  await applySchema();
}

export async function closePool() {
  await pool.end();
}
