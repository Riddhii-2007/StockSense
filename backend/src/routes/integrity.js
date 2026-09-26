import express from 'express';
import { checkIntegrity } from '../services/integrity.js';

const router = express.Router();

/**
 * GET /api/integrity
 * Recomputes every balance from the ledger and reports each invariant.
 * Rendered in the top bar, and the closing beat of the demo.
 */
router.get('/', async (req, res) => {
  const report = await checkIntegrity();
  res.json({
    success: true,
    ...report,
    message: report.ok
      ? `Ledger integrity verified across ${report.ledgerEntries} entries.`
      : `${report.discrepancies.length} discrepancy(ies) found.`,
  });
});

export default router;
