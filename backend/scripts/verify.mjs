/**
 * End-to-end check of the guarantees the demo depends on.
 *
 *   npm run verify
 *
 * Starts the server itself, waits for it to answer, runs every check, then
 * shuts it down. Set KEEP_SERVER=1 to leave it running afterwards.
 * Set BASE to test an already-running instance instead (e.g. a hosted DB).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
const BASE = process.env.BASE || `http://localhost:${PORT}/api`;

let child = null;

async function waitForHealth(timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

if (!process.env.BASE) {
  child = spawn(process.execPath, [path.join(here, '../src/server.js')], {
    cwd: path.join(here, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });
  const banner = (buf) => process.stdout.write(`  [server] ${buf}`);
  child.stdout.on('data', banner);
  child.stderr.on('data', (b) => {
    const text = String(b);
    if (!text.includes('injected env')) process.stderr.write(`  [server] ${text}`);
  });
  if (!(await waitForHealth())) {
    console.error('\nServer did not become healthy. Check the [server] output above.\n');
    child.kill();
    process.exit(1);
  }
}

let pass = 0;
let fail = 0;

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

const get = (p) => api(p);
const post = (p, data) => api(p, { method: 'POST', body: JSON.stringify(data) });

console.log('\n1. Health and reset');
await post('/demo/reset', {});
const health = await get('/health');
check('health responds', health.body?.success === true);

console.log('\n2. Seed data and boot integrity');
const products = await get('/inventory/products');
check('10 seeded products', products.body?.products?.length === 10, `got ${products.body?.products?.length}`);
const steel = products.body.products.find((p) => p.name === 'Steel Rod');
check('Steel Rod present', !!steel);
const integrity0 = await get('/integrity');
check('integrity OK after seed', integrity0.body?.ok === true, JSON.stringify(integrity0.body?.discrepancies));

const mainStore = steel.total_quantity; // 120 Main Store + 20 Production Rack = 140
check('Steel Rod seeded at 140 across locations', mainStore === 140, `got ${mainStore}`);

const lowAtBoot = await get('/inventory/low-stock');
check(
  'Steel Rod at Production Rack is genuinely low stock on a fresh database',
  lowAtBoot.body.lowStock.some((r) => r.product_name === 'Steel Rod' && r.location_name === 'Production Rack'),
  JSON.stringify(lowAtBoot.body.lowStock)
);

console.log('\n3. Auth: login and OTP reset');
const badLogin = await post('/auth/login', { email: 'admin@stocksense.com', password: 'wrong' });
check('wrong password rejected', badLogin.status === 401);
const login = await post('/auth/login', { email: 'admin@stocksense.com', password: 'admin123' });
check('correct password accepted', login.body?.success === true);
check('login never returns the password hash', !JSON.stringify(login.body).includes('scrypt$'));

const otp = await post('/auth/request-otp', { email: 'admin@stocksense.com' });
check('OTP issued', !!otp.body?.demoOtp, JSON.stringify(otp.body));
const unknownOtp = await post('/auth/request-otp', { email: 'nobody@nowhere.com' });
check(
  'unknown email gives identical generic response (no user enumeration)',
  unknownOtp.body?.message === otp.body?.message && !unknownOtp.body?.demoOtp
);
const wrongOtp = await post('/auth/reset-password', {
  email: 'admin@stocksense.com',
  otp: '000000',
  newPassword: 'newpassword123',
});
check('wrong OTP rejected', wrongOtp.status === 400);
const reset = await post('/auth/reset-password', {
  email: 'admin@stocksense.com',
  otp: otp.body.demoOtp,
  newPassword: 'newpassword123',
});
check('correct OTP resets password', reset.body?.success === true);
const relogin = await post('/auth/login', { email: 'admin@stocksense.com', password: 'newpassword123' });
check('login works with new password', relogin.body?.success === true);
await post('/auth/reset-password', { email: 'admin@stocksense.com', otp: 'x', newPassword: 'x' }).catch(() => {});

console.log('\n4. Natural language -> intent -> preview');
const nl = await post('/parse', { text: 'transfer 20 Steel Rod from Main Store to Production Rack' });
check('NL parsed a TRANSFER', nl.body?.intent?.type === 'transfer', JSON.stringify(nl.body?.intent));
check('NL extracted quantity 20', nl.body?.intent?.quantity === 20);
check('NL resolved Steel Rod', /steel/i.test(nl.body?.intent?.product ?? ''), JSON.stringify(nl.body?.intent));
check('NL resolved both locations', !!nl.body?.validation?.resolved?.sourceLocation && !!nl.body?.validation?.resolved?.destLocation);
check('NL preview validated OK', nl.body?.validation?.ok === true, JSON.stringify(nl.body?.validation?.errors));
check(
  'NL preview shows before/after impact',
  nl.body?.validation?.impacts?.[0]?.locations?.length === 2,
  JSON.stringify(nl.body?.validation?.impacts)
);

console.log('\n5. Blocked case writes nothing');
const before = await get('/ledger?limit=1000');
const beforeCount = before.body.entries.length;
const blocked = await post('/operations/preview', {
  type: 'transfer',
  sourceLocation: 'Main Store',
  destLocation: 'Production Rack',
  lines: [{ product: 'Steel Rod', quantity: 9999 }],
});
check('oversized transfer blocked', blocked.status === 422 && blocked.body?.success === false);
check('blocked preview names the shortfall', /Insufficient stock/.test(blocked.body?.message ?? ''), blocked.body?.message);
check(
  'blocked preview reports availability at the source location',
  /has 120 available/.test(blocked.body?.message ?? ''),
  blocked.body?.message
);
const afterBlocked = await get('/ledger?limit=1000');
check('blocked preview wrote no ledger rows', afterBlocked.body.entries.length === beforeCount);

const badCommit = await post('/operations', {
  type: 'delivery',
  sourceLocation: 'Main Store',
  lines: [{ product: 'Steel Rod', quantity: 9999 }],
});
check('blocked commit refused with 422', badCommit.status === 422, `got ${badCommit.status}`);
const afterBadCommit = await get('/ledger?limit=1000');
check('blocked commit wrote no ledger rows', afterBadCommit.body.entries.length === beforeCount);

console.log('\n6. Valid transfer: create, reserve, post');
const create = await post('/operations', {
  type: 'transfer',
  sourceLocation: 'Main Store',
  destLocation: 'Production Rack',
  reference: 'TRF-1001',
  lines: [{ product: 'Steel Rod', quantity: 20 }],
});
check('operation created as READY', create.body?.operation?.status === 'ready', create.body?.operation?.status);
const opId = create.body.operation.id;

const reserved = await get('/inventory');
const rackBefore = reserved.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Production Rack'
);
const mainBefore = reserved.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Main Store'
);
check('READY reserved source stock', mainBefore.reserved === 20, `reserved=${mainBefore.reserved}`);
check('READY did not change on-hand', mainBefore.quantity === 120, `qty=${mainBefore.quantity}`);

const posted = await post(`/operations/${opId}/post`, {});
check('post succeeded', posted.body?.success === true, posted.body?.message);
check('status is DONE', posted.body?.operation?.status === 'done');

const afterPost = await get('/inventory');
const mainAfter = afterPost.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Main Store'
);
const rackAfter = afterPost.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Production Rack'
);
check('source decreased 120 -> 100', mainAfter.quantity === 100, `got ${mainAfter.quantity}`);
check('destination increased 20 -> 40', rackAfter.quantity === 40, `got ${rackAfter.quantity}`);
check('reservation consumed on post', mainAfter.reserved === 0, `reserved=${mainAfter.reserved}`);

console.log('\n7. Ledger and integrity after posting');
const ledger = await get('/ledger?limit=50');
const entries = ledger.body.entries.filter((e) => e.reference === 'TRF-1001');
check('two ledger rows written (out + in)', entries.length === 2, `got ${entries.length}`);
// `quantity` is the unsigned magnitude the team's ledger stores; the signed
// per-location movement is `quantity_change`, which is what the audit chain and
// the integrity recompute both replay.
check('transfer out recorded as -20', entries.some((e) => e.operation_type === 'transfer' && e.quantity_change === -20));
check('transfer in recorded as +20', entries.some((e) => e.operation_type === 'transfer' && e.quantity_change === 20));
const integrity1 = await get('/integrity');
check('integrity still OK after posting', integrity1.body?.ok === true, JSON.stringify(integrity1.body?.discrepancies));
check('all six invariants evaluated', integrity1.body?.invariants?.length === 6);
check('all six invariants pass', integrity1.body?.invariants?.every((i) => i.passed));
check('ledger proven append-only', integrity1.body?.immutableLedger?.ok === true, JSON.stringify(integrity1.body?.immutableLedger));

console.log('\n8. Status lifecycle and cancel');
const toCreate = await post('/operations', {
  type: 'delivery',
  sourceLocation: 'Main Store',
  lines: [{ product: 'Steel Rod', quantity: 5 }],
  autoReady: false,
});
const delivId = toCreate.body.operation.id;
check('created as DRAFT when autoReady=false', toCreate.body?.operation?.status === 'draft');
const waiting = await post(`/operations/${delivId}/status`, { status: 'waiting' });
check('DRAFT -> WAITING', waiting.body?.operation?.status === 'waiting');
const badJump = await post(`/operations/${delivId}/status`, { status: 'done' });
check('WAITING -> DONE refused', badJump.status === 409 || badJump.body?.operation?.status !== 'done');
const ready = await post(`/operations/${delivId}/status`, { status: 'ready' });
check('WAITING -> READY', ready.body?.operation?.status === 'ready');

const afterReserve = await get('/inventory');
const mainReserved = afterReserve.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Main Store'
);
check('READY reserved 5 units', mainReserved.reserved === 5, `reserved=${mainReserved.reserved}`);
check('reservation reduces available to 95', mainReserved.available === 95, `available=${mainReserved.available}`);

const cancel = await post(`/operations/${delivId}/cancel`, { reason: 'Duplicate request' });
check('cancel sets CANCELED', cancel.body?.operation?.status === 'canceled');
check('cancel reason recorded', cancel.body?.operation?.cancel_reason === 'Duplicate request');
const afterCancel = await get('/inventory');
const mainAfterCancel = afterCancel.body.inventory.find(
  (r) => r.product_name === 'Steel Rod' && r.location_name === 'Main Store'
);
check('cancel released the reservation', mainAfterCancel.reserved === 0, `reserved=${mainAfterCancel.reserved}`);
const integrity2 = await get('/integrity');
check('integrity OK after cancel', integrity2.body?.ok === true);

console.log('\n9. Same-source transfer rejected');
const sameLoc = await post('/operations/preview', {
  type: 'transfer',
  sourceLocation: 'Main Store',
  destLocation: 'Main Store',
  lines: [{ product: 'Steel Rod', quantity: 1 }],
});
check('same source and destination rejected', sameLoc.status === 422);
check('error explains why', /different locations/.test(sameLoc.body?.message ?? ''), sameLoc.body?.message);

console.log('\n10. Dashboard reflects the posted state');
const dash = await get('/dashboard');
check('dashboard responds', dash.body?.success === true);
check('dashboard reports integrity', dash.body?.integrity?.ok === true);
check('activity feed populated', dash.body?.recent?.length > 0);
check('low stock panel never empty', dash.body?.lowStock?.length > 0, `got ${dash.body?.lowStock?.length}`);
check(
  'transferring 20 in cleared the Steel Rod low-stock warning at Production Rack',
  !dash.body.lowStock.some((r) => r.product_name === 'Steel Rod' && r.location_name === 'Production Rack'),
  'Production Rack is now 40, above its reorder level of 20'
);
check(
  'a genuinely low item is still surfaced',
  dash.body.lowStock.some((r) => r.product_name === 'Packing Tape' && r.min_stock === 30),
  JSON.stringify(dash.body?.lowStock)
);

console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}\n`);

if (child && process.env.KEEP_SERVER !== '1') child.kill();
process.exit(fail === 0 ? 0 : 1);
