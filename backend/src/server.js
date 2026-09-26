import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import operationsRoutes from './routes/operations.js';
import inventoryRoutes from './routes/inventory.js';
import ledgerRoutes from './routes/ledger.js';
import integrityRoutes from './routes/integrity.js';
import dashboardRoutes from './routes/dashboard.js';
import parseRoutes from './routes/parse.js';
import dbTestRoutes from './routes/dbTest.js';
import { reseed, seedIfEmpty } from './db/seed.js';
import { applySchema, DRIVER } from './db/index.js';
import { checkIntegrity } from './services/integrity.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/operations', operationsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/integrity', integrityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/parse', parseRoutes);
// Connectivity check. Reports the driver actually in use, plus an optional
// Supabase PostgREST probe.
app.use('/api', dbTestRoutes);

// Demo helper: restore known-good seed data. Guarded so it cannot run in production.
app.post('/api/demo/reset', async (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.status(403).json({ success: false, message: 'Disabled in production.' });
  }
  const summary = await reseed();
  return res.json({
    success: true,
    message: `Database reset. ${summary.products} products, ${summary.operations} opening receipts posted.`,
    ...summary,
  });
});

// Central error handler: services throw errors with .status and .details.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({
    success: false,
    message: err.message || 'Unexpected server error.',
    ...(err.details ? { validation: err.details } : {}),
  });
});

async function start() {
  console.log(`Database driver: ${DRIVER}`);

  // A hosted database starts empty; create the schema, then seed it.
  if (DRIVER === 'postgres') {
    await applySchema();
  }

  const seeded = await seedIfEmpty();
  if (seeded) console.log(`Seeded database: ${seeded.products} products, ${seeded.users} users.`);

  // Fail fast if the ledger does not reconcile. A demo must never start on an
  // inconsistent database.
  const report = await checkIntegrity();
  console.log(
    `Ledger integrity at boot: ${report.ok ? 'OK' : 'FAILED'} ` +
      `(${report.ledgerEntries} entries, ${report.discrepancies.length} discrepancies)`
  );
  if (!report.ok) {
    for (const inv of report.invariants.filter((i) => !i.passed)) {
      console.error(`  ${inv.id} FAILED: ${inv.name} (${inv.detail})`);
    }
    process.exitCode = 1;
  }

  app.listen(config.port, () => {
    console.log(`StockSense backend running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
