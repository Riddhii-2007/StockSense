import express from 'express';
import { listLedger } from '../services/integrity.js';

const router = express.Router();

/** GET /api/ledger - the append-only audit trail. */
router.get('/', async (req, res) => {
  // Ids are passed through as opaque strings. products.id and locations.id are
  // uuid on PostgreSQL, so Number() here would yield NaN and silently match
  // nothing; on SQLite they are integers, which the driver coerces anyway.
  res.json({
    success: true,
    entries: await listLedger({
      productId: req.query.productId || undefined,
      locationId: req.query.locationId || undefined,
      limit: req.query.limit ? Number(req.query.limit) : 100,
    }),
  });
});

export default router;
