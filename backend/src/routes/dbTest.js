import express from 'express';
import { db, DRIVER } from '../db/index.js';
import { isSupabaseConfigured, getSupabase } from '../config/supabaseClient.js';

const router = express.Router();

/**
 * GET /api/db-test
 *
 * Reports on the driver the app is ACTUALLY running on, not on a second,
 * parallel client. Two clients writing the same tables is how a demo ends up
 * reading a different database than it writes.
 *
 * The Supabase PostgREST probe is reported separately and is purely
 * informational: it proves the project is reachable and that the schema is
 * visible over PostgREST, which is a different question from "can the app talk
 * to its database".
 */
router.get('/db-test', async (req, res) => {
  const out = { success: true, driver: DRIVER, supabaseConfigured: isSupabaseConfigured };

  // The driver in use. A failure here is a real failure.
  try {
    const [products, locations, ledger] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS n FROM products').get(),
      db.prepare('SELECT COUNT(*) AS n FROM locations').get(),
      db.prepare('SELECT COUNT(*) AS n FROM stock_ledger').get(),
    ]);
    out.driverCounts = {
      products: products?.n ?? 0,
      locations: locations?.n ?? 0,
      ledgerEntries: ledger?.n ?? 0,
    };
    out.message = `Connected via ${DRIVER}.`;
  } catch (error) {
    return res.status(500).json({
      success: false,
      driver: DRIVER,
      message: 'Database query failed on the active driver.',
      error: error.message,
    });
  }

  // Optional PostgREST reachability probe. Never fails the request: the app does
  // not depend on it, and a network hiccup here should not look like a broken app.
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await getSupabase()
        .from('products')
        .select('id, sku, name, current_stock')
        .limit(5);
      if (error) {
        out.postgrest = { reachable: true, ok: false, error: error.message };
      } else {
        out.postgrest = { reachable: true, ok: true, sample: data };
      }
    } catch (error) {
      out.postgrest = { reachable: false, ok: false, error: error.message };
    }
  } else {
    out.postgrest = { reachable: false, ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.' };
  }

  return res.json(out);
});

export default router;
