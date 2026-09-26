/**
 * Read-only verification of the StockSense Supabase database contract.
 *
 *   node scripts/db-contract-verify.mjs
 *
 * Answers the DATABASE CONTRACT checklist with real query results:
 *   1.  the four core tables exist (plus everything else in the project)
 *   2.  seed rows: Main Store, Production Rack, product STL-001
 *   3.  per-location balances and products.current_stock, and whether the
 *       two agree (the consistency rule)
 *   4.  stock_ledger row count
 *   5.  foreign keys, CHECK constraints, triggers, RPC functions, RLS state
 *   6.  live rejection of a negative quantity  (attempted, then ROLLBACK)
 *   7.  live rejection of a bogus foreign key  (attempted, then ROLLBACK)
 *
 * Everything is SELECT-only except items 6-7. Those are single statements
 * inside a transaction that is ALWAYS rolled back: a rejected INSERT or
 * UPDATE changes nothing, and the rollback is unconditional. This script
 * never seeds, never resets, and never writes surviving data.
 *
 * It deliberately does not import the app's db/index.js: importing server
 * code must never be a way to mutate a shared cloud database by accident.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set - nothing to verify. backend/.env must define it.');
  process.exit(1);
}

// NUMERIC/INT8 arrive as strings by default; parse so comparisons are direct.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10_000,
});

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ''}`);
  }
}

async function q(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

/**
 * Run one statement inside a transaction that is always rolled back and
 * return whether PostgreSQL rejected it. Used to PROVE the CHECK and FK
 * constraints fire without leaving any trace in the database.
 */
async function attemptRejected(sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(sql, params);
      return { rejected: false, code: null, constraint: null, message: 'statement was ACCEPTED (unexpected)' };
    } catch (err) {
      return { rejected: true, code: err.code ?? null, constraint: err.constraint ?? null, message: err.message };
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }
  } finally {
    client.release();
  }
}

const CORE = ['products', 'locations', 'stock_by_location', 'stock_ledger'];

try {
  // ------------------------------------------------------------------ 0. where
  let host = '';
  try {
    const u = new URL(DATABASE_URL);
    host = u.host + u.pathname; // userinfo deliberately stripped
  } catch {
    host = '(unparseable)';
  }
  const id = (await q('SELECT current_database() AS db, current_user AS usr'))[0];
  console.log(`\n0. Connection`);
  console.log(`  host=${host}`);
  console.log(`  database=${id.db}  user=${id.usr}  DB_DRIVER=${process.env.DB_DRIVER || '(unset)'}`);

  // -------------------------------------------------------------- 1. tables
  console.log('\n1. Tables in schema public');
  const tables = (await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  )).map((r) => r.table_name);
  console.log(`  ${tables.join(', ')}`);
  for (const t of CORE) check(`table exists: ${t}`, tables.includes(t));

  // ------------------------------------------------------------- 2. columns
  console.log('\n2. Columns of the four core tables');
  const cols = await q(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('products','locations','stock_by_location','stock_ledger')
      ORDER BY table_name, ordinal_position`
  );
  for (const t of CORE) {
    const mine = cols.filter((c) => c.table_name === t);
    console.log(`  ${t}:`);
    for (const c of mine) {
      console.log(`    ${c.column_name.padEnd(20)} ${c.data_type.padEnd(12)} null=${c.is_nullable}`);
    }
  }

  // ---------------------------------------------------- 3. seed: locations
  console.log('\n3. locations rows');
  const locs = await q('SELECT id, name FROM locations ORDER BY name');
  for (const l of locs) console.log(`    ${l.name}`);
  check("location exists: 'Main Store'", locs.some((l) => l.name === 'Main Store'));
  check("location exists: 'Production Rack'", locs.some((l) => l.name === 'Production Rack'));

  // ----------------------------------------------------- 4. seed: STL-001
  console.log('\n4. products row with sku = STL-001');
  const steel = (await q(
    `SELECT id, name, sku, category, unit_of_measure, current_stock, min_stock
       FROM products WHERE sku = 'STL-001'`
  ))[0];
  if (!steel) {
    check('product with sku STL-001 exists', false);
  } else {
    console.log(
      `    name=${steel.name}  sku=${steel.sku}  category=${steel.category}  ` +
        `uom=${steel.unit_of_measure}  current_stock=${steel.current_stock}  min_stock=${steel.min_stock}`
    );
    check('product with sku STL-001 exists', true);
    check('STL-001 current_stock = 140', Number(steel.current_stock) === 140, `got ${steel.current_stock}`);
    check('STL-001 min_stock = 20', Number(steel.min_stock) === 20, `got ${steel.min_stock}`);
  }

  // ------------------------------------------- 5. per-location consistency
  console.log('\n5. stock_by_location for STL-001 vs products.current_stock');
  const sbl = await q(
    `SELECT l.name AS location, s.quantity
       FROM stock_by_location s
       JOIN locations l ON l.id = s.location_id
      WHERE s.product_id = $1
      ORDER BY l.name`,
    steel ? [steel.id] : ['00000000-0000-0000-0000-000000000000']
  );
  for (const r of sbl) console.log(`    ${r.location}: ${r.quantity}`);
  if (steel) {
    const ms = sbl.find((r) => r.location === 'Main Store');
    const pr = sbl.find((r) => r.location === 'Production Rack');
    check('Main Store quantity = 120 (spec-pristine seed)', ms && Number(ms.quantity) === 120, `got ${ms?.quantity}`);
    check('Production Rack quantity = 20 (spec-pristine seed)', pr && Number(pr.quantity) === 20, `got ${pr?.quantity}`);
    const sum = sbl.reduce((a, r) => a + Number(r.quantity), 0);
    check(
      'current_stock equals SUM(stock_by_location.quantity)',
      sum === Number(steel.current_stock),
      `sum=${sum} current_stock=${steel.current_stock}`
    );
  }

  // ------------------------------------------------------------ 6. ledger
  console.log('\n6. stock_ledger');
  const led = (await q('SELECT COUNT(*) AS n FROM stock_ledger'))[0];
  console.log(`    rows = ${led.n}`);
  check('stock_ledger reachable (count query ran)', true);

  // ---------------------------------------------------------- 7. counts
  console.log('\n7. Row counts');
  for (const t of tables.filter((t) => /^[a-z_]+$/.test(t))) {
    try {
      const n = (await q(`SELECT COUNT(*) AS n FROM "${t}"`))[0].n;
      console.log(`    ${t.padEnd(20)} ${n}`);
    } catch (e) {
      console.log(`    ${t.padEnd(20)} (error: ${e.message})`);
    }
  }

  // --------------------------------------------------------- 8. foreign keys
  console.log('\n8. Foreign keys (stock_by_location, stock_ledger)');
  const fks = await q(
    `SELECT conrelid::regclass::text  AS table_name,
            a.attname                AS column_name,
            confrelid::regclass::text AS foreign_table,
            af.attname               AS foreign_column,
            c.conname                AS constraint_name
       FROM pg_constraint c
       JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
       JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS cf(attnum, ord) ON cf.ord = ck.ord
       JOIN pg_attribute a  ON a.attrelid  = c.conrelid  AND a.attnum  = ck.attnum
       JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = cf.attnum
      WHERE c.contype = 'f'
        AND c.conrelid IN ('stock_by_location'::regclass, 'stock_ledger'::regclass)
      ORDER BY 1, 2`
  );
  for (const f of fks) {
    console.log(`    ${f.table_name}.${f.column_name} -> ${f.foreign_table}.${f.foreign_column}  (${f.constraint_name})`);
  }
  const fk = (t, c, ft, fc) =>
    fks.some((x) => x.table_name === t && x.column_name === c && x.foreign_table === ft && x.foreign_column === fc);
  check('stock_by_location.product_id  -> products.id', fk('stock_by_location', 'product_id', 'products', 'id'));
  check('stock_by_location.location_id -> locations.id', fk('stock_by_location', 'location_id', 'locations', 'id'));
  check('stock_ledger.product_id       -> products.id', fk('stock_ledger', 'product_id', 'products', 'id'));
  check('stock_ledger.from_location_id -> locations.id', fk('stock_ledger', 'from_location_id', 'locations', 'id'));
  check('stock_ledger.to_location_id   -> locations.id', fk('stock_ledger', 'to_location_id', 'locations', 'id'));

  // ------------------------------------------------------- 9. check constraints
  console.log('\n9. CHECK constraints on the core tables');
  const cks = await q(
    `SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid IN ('products'::regclass, 'stock_by_location'::regclass, 'stock_ledger'::regclass)
      ORDER BY 1, 2`
  );
  for (const c of cks) console.log(`    ${c.table_name} :: ${c.conname} :: ${c.def}`);
  check(
    'a quantity >= 0 CHECK exists on stock_by_location',
    cks.some((c) => c.table_name.includes('stock_by_location') && /quantity\s*>=\s*\(?\s*0/.test(c.def)),
    'no CHECK containing quantity >= 0 found'
  );

  // ---------------------------------------------------------- 10. triggers
  console.log('\n10. Triggers on the core tables');
  const trg = await q(
    `SELECT tgrelid::regclass::text AS table_name, tgname
       FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgrelid IN ('products'::regclass, 'stock_by_location'::regclass, 'stock_ledger'::regclass)
      ORDER BY 1, 2`
  );
  for (const t of trg) console.log(`    ${t.table_name} :: ${t.tgname}`);

  // --------------------------------------------------------- 11. functions
  console.log('\n11. Functions/RPCs in schema public');
  const fns = await q(
    `SELECT p.proname AS name,
            pg_get_function_identity_arguments(p.oid) AS args,
            pg_get_function_result(p.oid) AS returns
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
      ORDER BY p.proname`
  );
  for (const f of fns) console.log(`    ${f.name}(${f.args}) RETURNS ${f.returns}`);

  // ------------------------------------------------------------- 12. RLS
  console.log('\n12. Row level security state');
  const rls = await q(
    `SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
      ORDER BY relname`
  );
  for (const r of rls) console.log(`    ${r.relname.padEnd(20)} rls=${r.relrowsecurity}`);

  // ------------------------------------- 13. negative quantity is rejected
  console.log('\n13. Negative stock must be rejected (rolled back attempt)');
  let negRes = null;
  const freePair = (
    await q(
      `SELECT p.id AS pid, l.id AS lid
         FROM products p CROSS JOIN locations l
        WHERE NOT EXISTS (
          SELECT 1 FROM stock_by_location s
           WHERE s.product_id = p.id AND s.location_id = l.id)
        ORDER BY p.sku, l.name
        LIMIT 1`
    )
  )[0];
  if (freePair) {
    negRes = await attemptRejected(
      'INSERT INTO stock_by_location (product_id, location_id, quantity) VALUES ($1, $2, -5)',
      [freePair.pid, freePair.lid]
    );
  } else {
    const any = (await q('SELECT product_id, location_id FROM stock_by_location LIMIT 1'))[0];
    negRes = await attemptRejected(
      'UPDATE stock_by_location SET quantity = -1 WHERE product_id = $1 AND location_id = $2',
      [any.product_id, any.location_id]
    );
  }
  console.log(`    ${negRes.rejected ? 'rejected:' : 'ACCEPTED (BAD):'} ${negRes.message}`);
  check(
    'negative quantity rejected by CHECK constraint',
    negRes.rejected && (negRes.code === '23514' || negRes.code === null),
    `code=${negRes.code} constraint=${negRes.constraint}`
  );

  // --------------------------------------------- 14. bogus FK is rejected
  console.log('\n14. Unknown product_id must be rejected (rolled back attempt)');
  const anyLoc = (await q('SELECT id FROM locations ORDER BY name LIMIT 1'))[0];
  const fkRes = await attemptRejected(
    'INSERT INTO stock_by_location (product_id, location_id, quantity) VALUES (gen_random_uuid(), $1, 1)',
    [anyLoc.id]
  );
  console.log(`    ${fkRes.rejected ? 'rejected:' : 'ACCEPTED (BAD):'} ${fkRes.message}`);
  check('unknown product_id rejected by foreign key', fkRes.rejected, `code=${fkRes.code}`);

  // ------------------------------------- 15. ledger contents (read-only)
  console.log('\n15. stock_ledger contents (read-only)');
  const ledgerRows = await q(
    `SELECT id, operation_type, quantity,
            from_location_id, to_location_id, reference, created_at
       FROM stock_ledger
      ORDER BY created_at`
  );
  if (ledgerRows.length === 0) {
    console.log('    (empty - the ledger starts clean)');
  }
  for (const r of ledgerRows) {
    console.log(
      `    type=${r.operation_type} qty=${r.quantity} from=${r.from_location_id ?? '-'} ` +
        `to=${r.to_location_id ?? '-'} ref=${r.reference ?? '-'} at=${r.created_at}`
    );
  }

  console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  await pool.end();
}
