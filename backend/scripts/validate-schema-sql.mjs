/**
 * Validates backend/src/config/schema.sql against the real database WITHOUT
 * changing anything: the whole file runs inside BEGIN ... ROLLBACK, so every
 * statement must parse and execute, and nothing persists.
 *
 *   node scripts/validate-schema-sql.mjs
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const here = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(here, '../src/config/schema.sql'), 'utf8');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(sql);
  // Prove the seed logic is coherent inside the transaction (rolled back after).
  const chk = await client.query(
    `SELECT p.sku, p.current_stock,
            (SELECT SUM(quantity) FROM stock_by_location WHERE product_id = p.id) AS loc_sum
       FROM products p WHERE p.sku = 'STL-001'`
  );
  console.log('in-transaction check:', JSON.stringify(chk.rows[0]));
  await client.query('ROLLBACK');
  console.log('PASS  schema.sql executes cleanly (validated, rolled back - nothing persisted)');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('FAIL  schema.sql error:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
