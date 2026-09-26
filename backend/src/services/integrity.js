import { db, transaction, LEDGER_ORDER } from '../db/index.js';

const key = (productId, locationId) => `${productId}:${locationId}`;

/**
 * Recompute every balance from the append-only ledger and compare against the
 * inventory table.
 *
 * Summed from `quantity_change`, never from `stock_after`: the stored running
 * balance is derived data, so validating against it would only prove the code
 * agrees with itself. `quantity` is also unusable here because the team's ledger
 * stores it as an unsigned magnitude, so summing it would count a departure as
 * an arrival.
 */
export async function checkIntegrity() {
  const ledgerRows = await db
    .prepare(
      `SELECT product_id, location_id, SUM(quantity_change) AS qty, COUNT(*) AS entries
         FROM stock_ledger GROUP BY product_id, location_id`
    )
    .all();

  const inventoryRows = await db.prepare('SELECT product_id, location_id, quantity, reserved FROM stock_by_location').all();

  const fromLedger = new Map(ledgerRows.map((r) => [key(r.product_id, r.location_id), r]));
  const fromInventory = new Map(inventoryRows.map((r) => [key(r.product_id, r.location_id), r]));

  const discrepancies = [];

  for (const [k, inv] of fromInventory) {
    const led = fromLedger.get(k);
    const expected = led?.qty ?? 0;
    if (inv.quantity !== expected) {
      discrepancies.push({
        productId: inv.product_id,
        locationId: inv.location_id,
        stored: inv.quantity,
        recomputed: expected,
        delta: inv.quantity - expected,
      });
    }
  }
  for (const [k, led] of fromLedger) {
    if (!fromInventory.has(k)) {
      discrepancies.push({
        productId: led.product_id,
        locationId: led.location_id,
        stored: 0,
        recomputed: led.qty,
        delta: -led.qty,
      });
    }
  }

  const invariants = [];

  invariants.push({
    id: 'INV-1',
    name: 'On-hand balance equals the sum of ledger entries',
    passed: discrepancies.length === 0,
    detail: `${discrepancies.length} discrepanc${discrepancies.length === 1 ? 'y' : 'ies'}`,
  });

  const negatives = await db
    .prepare('SELECT product_id, location_id, quantity FROM stock_by_location WHERE quantity < 0')
    .all();
  invariants.push({
    id: 'INV-2',
    name: 'No location holds a negative on-hand quantity',
    passed: negatives.length === 0,
    detail: `${negatives.length} violation(s)`,
  });

  const badReserved = await db
    .prepare('SELECT product_id, location_id, reserved, quantity FROM stock_by_location WHERE reserved > quantity')
    .all();
  invariants.push({
    id: 'INV-3',
    name: 'Reserved quantity never exceeds on-hand quantity',
    passed: badReserved.length === 0,
    detail: `${badReserved.length} violation(s)`,
  });

  // Replay each product+location in true insertion order. LEDGER_ORDER is a
  // monotonic counter supplied by the driver (a sequence on PostgreSQL, rowid on
  // SQLite) because created_at ties - it is second-resolution in SQLite and
  // identical for every row of one transaction - and the primary key is a random
  // v4 uuid, so neither can order the chain.
  const chainRows = await db
    .prepare(
      // quantity_change is the signed per-location movement and is what the
      // chain replays. `quantity` is the unsigned magnitude the team stores, so
      // summing it would make a departure look like an arrival.
      `SELECT id, product_id, location_id, quantity_change, stock_after, ${LEDGER_ORDER} AS seq
         FROM stock_ledger
        ORDER BY product_id, location_id, seq`
    )
    .all();
  const running = new Map();
  let chainBreaks = 0;
  for (const row of chainRows) {
    const k = key(row.product_id, row.location_id);
    const next = (running.get(k) ?? 0) + row.quantity_change;
    if (next !== row.stock_after) chainBreaks += 1;
    running.set(k, next);
  }
  invariants.push({
    id: 'INV-4',
    name: 'Stored running balance matches a running sum of quantity changes',
    passed: chainBreaks === 0,
    detail: `${chainBreaks} break(s) across ${chainRows.length} entries`,
  });

  const orphan = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM stock_ledger le
        WHERE NOT EXISTS (SELECT 1 FROM operations o
                           WHERE o.id = le.operation_id AND o.status = 'done')`
    )
    .get();
  invariants.push({
    id: 'INV-5',
    name: 'Every ledger entry belongs to a posted (DONE) operation',
    passed: orphan.n === 0,
    detail: `${orphan.n} orphan entry/entries`,
  });

  // products.current_stock duplicates SUM(stock_by_location.quantity) so the
  // dashboard can read a single row. The team's original schema let the app
  // write that column by hand, which is exactly how the two drift apart. A
  // trigger now owns it, and this invariant is the proof: if anyone ever writes
  // current_stock directly, or the trigger is dropped, this fails.
  const cacheRows = await db
    .prepare(
      `SELECT p.id, p.current_stock,
              COALESCE((SELECT SUM(sbl.quantity) FROM stock_by_location sbl
                         WHERE sbl.product_id = p.id), 0) AS actual
         FROM products p`
    )
    .all();
  const cacheDrift = cacheRows.filter((r) => Number(r.current_stock) !== Number(r.actual));
  invariants.push({
    id: 'INV-6',
    name: 'products.current_stock equals the sum of its per-location balances',
    passed: cacheDrift.length === 0,
    detail:
      cacheDrift.length === 0
        ? `${cacheRows.length} product(s) consistent`
        : `${cacheDrift.length} drifted, e.g. ${cacheDrift[0].id}: cached ${cacheDrift[0].current_stock} vs actual ${cacheDrift[0].actual}`,
  });

  const immutable = await probeLedgerImmutability();

  return {
    ok: invariants.every((i) => i.passed) && immutable.ok,
    checkedAt: new Date().toISOString(),
    ledgerEntries: chainRows.length,
    inventoryRows: fromInventory.size,
    invariants,
    immutableLedger: immutable,
    discrepancies,
  };
}

/**
 * Prove the append-only triggers actually fire. The statement asks whether the
 * ledger can be edited; the honest answer is to attempt the edit and show the
 * database refusing.
 *
 * Runs inside a transaction that is always rolled back, so the probe cannot
 * leave a mark. A SAVEPOINT is required (and is why this is wrapped in a
 * transaction at all): on PostgreSQL a failed statement poisons the enclosing
 * transaction unless it is rolled back to a savepoint first.
 */
async function probeLedgerImmutability() {
  const row = await db.prepare('SELECT id FROM stock_ledger ORDER BY id LIMIT 1').get();
  if (!row) return { ok: true, attempted: false, reason: 'ledger is empty' };

  return transaction(async () => {
    await db.exec('SAVEPOINT immutability_probe');
    try {
      await db.prepare('UPDATE stock_ledger SET quantity = 999999 WHERE id = ?').run(row.id);
      await db.exec('ROLLBACK TO immutability_probe');
      await db.exec('RELEASE immutability_probe');
      return { ok: false, attempted: true, reason: 'UPDATE was accepted but should have been refused' };
    } catch (err) {
      await db.exec('ROLLBACK TO immutability_probe');
      await db.exec('RELEASE immutability_probe');
      return { ok: true, attempted: true, refusedWith: err.message };
    }
  }).catch((err) => ({
    ok: false,
    attempted: true,
    reason: `probe could not run: ${err.message}`,
  }));
}

export async function listLedger({ productId, locationId, limit = 100 } = {}) {
  const where = [];
  const params = [];
  if (productId) {
    where.push('le.product_id = ?');
    params.push(productId);
  }
  if (locationId) {
    where.push('le.location_id = ?');
    params.push(locationId);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      // le.operation_type (the movement kind) and o.operation_type (the parent
      // document's type) must not share a result column name. Recency uses the
      // driver's monotonic counter rather than le.id, because the primary key is
      // a random uuid and created_at ties within a transaction. le.quantity is
      // the unsigned magnitude the team stores; quantity_change is the signed
      // per-location movement.
      //
      // operations is LEFT joined on purpose. An append-only ledger must never
      // hide a row because the document that caused it is missing or unlinked, so
      // an orphan entry still appears, flagged by a null document_type. The
      // integrity check is what reports the orphan, not a silently shorter list.
      `SELECT le.*, p.sku, p.name AS product_name, l.name AS location_name,
              o.operation_type AS document_type, o.status AS document_status,
              o.reference AS document_reference
         FROM stock_ledger le
         LEFT JOIN products p   ON p.id = le.product_id
         LEFT JOIN locations l  ON l.id = le.location_id
         LEFT JOIN operations o ON o.id = le.operation_id
         ${clause}
        ORDER BY le.${LEDGER_ORDER} DESC
        LIMIT ?`
    )
    .all(...params, limit);
}
