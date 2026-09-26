import express from 'express';
import { db, LEDGER_ORDER } from '../db/index.js';
import { checkIntegrity } from '../services/integrity.js';

const router = express.Router();

/** GET /api/dashboard - the headline counts plus low stock and recent activity. */
router.get('/', async (req, res) => {
  const one = async (sql) => (await db.prepare(sql).get()) ?? {};

  const stats = {
    totalProducts: (await one('SELECT COUNT(*) AS n FROM products WHERE active')).n,
    totalLocations: (await one('SELECT COUNT(*) AS n FROM locations')).n,
    inventoryValue: Math.round(
      (await one('SELECT COALESCE(SUM(i.quantity * p.unit_cost), 0) AS v FROM stock_by_location i JOIN products p ON p.id = i.product_id')).v
    ),
    lowStockCount: (
      await one(
        'SELECT COUNT(*) AS n FROM stock_by_location i JOIN products p ON p.id = i.product_id WHERE i.quantity - i.reserved <= p.min_stock'
      )
    ).n,
    pendingOps: (
      await one("SELECT COUNT(*) AS n FROM operations WHERE status IN ('draft','waiting','ready')")
    ).n,
  };

  const byStatus = await db.prepare('SELECT status, COUNT(*) AS n FROM operations GROUP BY status').all();
  const byType = await db
    .prepare('SELECT operation_type AS type, COUNT(*) AS n FROM operations GROUP BY operation_type')
    .all();

  const recent = await db
    .prepare(
      // le.operation_type is the ledger row's movement kind (transfer/IN);
      // o.operation_type is the parent document's type. They are different
      // things and must not share a result column name, or the later alias
      // silently wins. quantity_change is the signed per-location movement;
      // le.quantity is only the unsigned magnitude.
      // Recency orders by operation_id rather than le.id because the ledger
      // primary key is a random uuid on PostgreSQL, so ORDER BY id is arbitrary.
      `SELECT le.id, le.operation_type, le.quantity_change, le.created_at,
              p.name AS product_name, l.name AS location_name,
              o.operation_type AS document_type, o.status AS document_status, o.reference
         FROM stock_ledger le
         JOIN products p   ON p.id = le.product_id
         JOIN locations l  ON l.id = le.location_id
         JOIN operations o ON o.id = le.operation_id
        ORDER BY le.${LEDGER_ORDER} DESC LIMIT 10`
    )
    .all();

  const lowStock = await db
    .prepare(
      `SELECT p.sku, p.name AS product_name, p.unit_of_measure, p.min_stock,
              i.quantity, i.reserved, i.quantity - i.reserved AS available, l.name AS location_name
         FROM stock_by_location i
         JOIN products p  ON p.id = i.product_id
         JOIN locations l ON l.id = i.location_id
        WHERE i.quantity - i.reserved <= p.min_stock
        ORDER BY available ASC LIMIT 8`
    )
    .all();

  const integrity = await checkIntegrity();

  res.json({
    success: true,
    stats,
    byStatus,
    byType,
    lowStock,
    recent,
    integrity: { ok: integrity.ok, checkedAt: integrity.checkedAt, ledgerEntries: integrity.ledgerEntries },
  });
});

export default router;
