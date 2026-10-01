import express from 'express';
import { validateOperation, resolveEntities, OPERATION_TYPES, STATUSES } from '../services/validation.js';
import { requireRole } from '../middleware/rbac.js';
import {
  createOperation,
  getOperation,
  listOperations,
  setStatus,
  postOperation,
  cancelOperation,
} from '../services/engine.js';

const router = express.Router();

/**
 * POST /api/operations/preview
 * Dry run. Never writes. Calls the same await validateOperation() that commit calls.
 */
router.post('/preview', async (req, res) => {
  const result = await validateOperation(req.body);
  res.status(result.ok ? 200 : 422).json({
    success: result.ok,
    // Surface the actual reason, not a generic refusal: a blocked preview is
    // only useful if it says what was wrong.
    message: result.ok ? 'Preview OK. Nothing was written.' : result.errors[0],
    ...result,
  });
});

/** POST /api/operations/resolve - free-text entity resolution for autocomplete. */
router.post('/resolve', async (req, res) => {
  res.json({ success: true, ...await resolveEntities(req.body) });
});

/** GET /api/operations/meta - enums for the UI filter axis. */
router.get('/meta', async (req, res) => {
  res.json({ success: true, types: OPERATION_TYPES, statuses: STATUSES });
});

/** GET /api/operations */
router.get('/', async (req, res) => {
  res.json({ success: true, operations: await listOperations({ status: req.query.status, type: req.query.type }) });
});

/**
 * Operation ids are UUIDs on PostgreSQL and hex strings on SQLite, so they are
 * opaque strings on both. They used to be coerced with Number(), which silently
 * turned every id into NaN once the ids stopped being integers. The shape is
 * checked instead so a bad id is a 400 rather than a database error.
 */
const ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$/i;

function operationId(req, res) {
  const raw = String(req.params.id ?? '').trim();
  if (!ID_PATTERN.test(raw)) {
    res.status(400).json({ success: false, message: 'id must be a uuid' });
    return null;
  }
  return raw;
}

/** GET /api/operations/:id */
router.get('/:id', async (req, res) => {
  const id = operationId(req, res);
  if (id === null) return undefined;
  const op = await getOperation(id);
  if (!op) return res.status(404).json({ success: false, message: 'Operation not found' });
  return res.json({ success: true, operation: op });
});

/**
 * POST /api/operations
 * Validate, store, and move straight to READY. Still writes no stock:
 * stock only moves on POST /:id/post.
 */
router.post('/', async (req, res) => {
  if (req.body.type === 'adjustment' && req.user?.role === 'STAFF') {
    return res.status(403).json({ success: false, message: 'Staff cannot perform adjustments' });
  }
  const createdBy = req.user?.email || 'demo';
  const op = await createOperation(req.body, createdBy);
  const ready = req.body.autoReady === false ? op : await setStatus(op.id, 'ready', createdBy);
  res.status(201).json({
    success: true,
    message: `Operation #${ready.id} created as ${ready.status}. No stock moved yet.`,
    operation: ready,
  });
});

/** POST /api/operations/:id/post - READY -> DONE. Moves stock, writes ledger. */
router.post('/:id/post', async (req, res) => {
  const id = operationId(req, res);
  if (id === null) return undefined;
  const op = await getOperation(id);
  if (op.type === 'adjustment' && req.user?.role === 'STAFF') {
    return res.status(403).json({ success: false, message: 'Staff cannot post adjustments' });
  }
  const posted = await postOperation(id, req.user?.email || 'demo');
  return res.json({
    success: true,
    message: `Operation #${posted.id} posted. Stock and ledger updated.`,
    operation: posted,
  });
});

/** POST /api/operations/:id/status - DRAFT -> WAITING -> READY, or CANCELED. */
router.post('/:id/status', async (req, res) => {
  const id = operationId(req, res);
  if (id === null) return undefined;
  const next = String(req.body?.status ?? '').toLowerCase();
  if (!STATUSES.includes(next)) {
    return res.status(400).json({ success: false, message: `status must be one of ${STATUSES.join(', ')}` });
  }
  if (next === 'done') {
    const op = await getOperation(id);
    if (op.type === 'adjustment' && req.user?.role === 'STAFF') {
      return res.status(403).json({ success: false, message: 'Staff cannot post adjustments' });
    }
    const posted = await postOperation(id, req.user?.email || 'demo');
    return res.json({ success: true, message: `Operation #${posted.id} posted.`, operation: posted });
  }
  if (next === 'canceled') {
    return res.json({
      success: true,
      message: `Operation #${id} canceled.`,
      operation: await cancelOperation(id, req.body?.reason ?? null, req.user?.email || 'demo'),
    });
  }
  return res.json({ success: true, operation: await setStatus(id, next, req.user?.email || 'demo') });
});

/** POST /api/operations/:id/cancel */
router.post('/:id/cancel', async (req, res) => {
  const id = operationId(req, res);
  if (id === null) return undefined;
  const op = await cancelOperation(id, req.body?.reason ?? null, req.body?.createdBy ?? 'demo');
  return res.json({ success: true, message: `Operation #${op.id} canceled.`, operation: op });
});

export default router;
