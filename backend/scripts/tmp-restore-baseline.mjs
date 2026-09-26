/**
 * One-off: restore the DATABASE CONTRACT baseline on the live Supabase DB.
 *
 * A manual test transfer (10 x Steel Rods, Main Store -> Production Rack) was
 * exercised on 2026-09-26, leaving:
 *   - stock_by_location 110 / 30  instead of 120 / 20
 *   - stock_ledger 1 row          instead of empty
 *   - operations 2 rows           instead of empty
 *
 * The user approved restoring the pristine baseline. The ledger is append-only
 * by trigger, so the delete trigger is lifted, the audit row is removed, and the
 * trigger is recreated - inside ONE transaction, so the database either comes
 * back as the exact baseline or is untouched.
 *
 * Safety: aborts unless the current state matches the measured deviant state
 * exactly, so it cannot silently delete newer real data.
 *
 *   node scripts/tmp-restore-baseline.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const n = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);

const ledgerRows = await n('SELECT COUNT(*) AS n FROM stock_ledger');
const opRows = await n('SELECT COUNT(*) AS n FROM operations');
const msQty = await n(
  `SELECT s.quantity AS n FROM stock_by_location s
    JOIN locations l ON l.id = s.location_id WHERE l.name = 'Main Store'`
);
const prQty = await n(
  `SELECT s.quantity AS n FROM stock_by_location s
    JOIN locations l ON l.id = s.location_id WHERE l.name = 'Production Rack'`
);
console.log(`current state: ledger=${ledgerRows} operations=${opRows} main_store=${msQty} production_rack=${prQty}`);

if (ledgerRows !== 1 || opRows !== 2 || msQty !== 110 || prQty !== 30) {
  console.error('ABORT: database is not in the expected deviant state. Nothing was changed.');
  await pool.end();
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // 1. Lift the append-only guard on the ledger.
  await client.query('DROP TRIGGER IF EXISTS ledger_no_delete ON stock_ledger');
  await client.query('DROP TRIGGER IF EXISTS ledger_no_update ON stock_ledger');

  // 2. Remove the test audit row and the two test documents.
  await client.query('DELETE FROM stock_ledger');
  await client.query('DELETE FROM operation_items'); // empty today; explicit for clarity
  await client.query('DELETE FROM operations');

  // 3. Restore the seeded balances. products.current_stock follows via the
  //    sync_stock_on_* triggers (it is already 140, so no value change).
  await client.query(
    `UPDATE stock_by_location s SET quantity = 120
       FROM locations l WHERE l.id = s.location_id AND l.name = 'Main Store'`
  );
  await client.query(
    `UPDATE stock_by_location s SET quantity = 20
       FROM locations l WHERE l.id = s.location_id AND l.name = 'Production Rack'`
  );

  // 4. Reinstate the append-only guard.
  await client.query(
    `CREATE TRIGGER ledger_no_update BEFORE UPDATE ON stock_ledger
       FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()`
  );
  await client.query(
    `CREATE TRIGGER ledger_no_delete BEFORE DELETE ON stock_ledger
       FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation()`
  );

  // 5. Assert the baseline INSIDE the transaction, before commit.
  const checks = [
    ['ledger empty', await n('SELECT COUNT(*) AS n FROM stock_ledger'), 0],
    ['operations empty', await n('SELECT COUNT(*) AS n FROM operations'), 0],
    ['main store 120', await n(
      `SELECT s.quantity AS n FROM stock_by_location s
        JOIN locations l ON l.id = s.location_id WHERE l.name = 'Main Store'`), 120],
    ['production rack 20', await n(
      `SELECT s.quantity AS n FROM stock_by_location s
        JOIN locations l ON l.id = s.location_id WHERE l.name = 'Production Rack'`), 20],
    ['current_stock 140', await n("SELECT current_stock AS n FROM products WHERE sku = 'STL-001'"), 140],
    ['ledger triggers restored', Number((await client.query(
      `SELECT COUNT(*) AS n FROM pg_trigger
        WHERE tgrelid = 'stock_ledger'::regclass AND tgname IN ('ledger_no_update','ledger_no_delete')`
    )).rows[0].n), 2],
  ];
  for (const [name, got, want] of checks) {
    if (got !== want) throw new Error(`${name}: got ${got}, want ${want}`);
    console.log(`  ok  ${name}`);
  }

  await client.query('COMMIT');
  console.log('COMMIT - baseline restored.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ROLLBACK - nothing changed. Reason:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
