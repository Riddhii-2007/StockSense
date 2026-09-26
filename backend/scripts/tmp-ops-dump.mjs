/**
 * One-off read-only inspection of operations + ledger linkage.
 * Usage: node scripts/tmp-ops-dump.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const ops = await pool.query(
  `SELECT id, operation_type, status, product_id, quantity,
          from_location_id, to_location_id, reference, notes, created_by, created_at
     FROM operations ORDER BY created_at`
);
console.log('operations:', JSON.stringify(ops.rows, null, 1));

const led = await pool.query(
  'SELECT id, operation_id, operation_type, quantity, reference, created_by FROM stock_ledger'
);
console.log('ledger:', JSON.stringify(led.rows, null, 1));

const opsFk = await pool.query(
  `SELECT conname FROM pg_constraint
   WHERE confrelid = 'stock_ledger'::regclass AND conrelid = 'stock_ledger'::regclass`
);
console.log('self constraints:', opsFk.rows.map((r) => r.conname));

await pool.end();
