import { db, resetSchema } from './index.js';
import { createOperation, setStatus, postOperation } from '../services/engine.js';
import { hashPassword } from '../utils/password.js';

const USERS = [
  { email: 'admin@stocksense.com', password: 'admin123', full_name: 'Aarav Shah', role: 'ADMIN' },
  { email: 'manager@stocksense.com', password: 'manager123', full_name: 'Meera Iyer', role: 'MANAGER' },
  { email: 'staff@stocksense.com', password: 'staff123', full_name: 'Rohan Das', role: 'STAFF' },
];

// The team's locations table is flat: (id, name, type). There is no warehouses
// table, so a location is its own storage point. `type` is uppercase to match
// the CHECK constraint on locations.type.
const LOCATIONS = [
  { name: 'Main Store', type: 'STORAGE' },
  { name: 'Production Rack', type: 'PRODUCTION' },
  { name: 'Quarantine Bay', type: 'QUARANTINE' },
];

// Deliberately unambiguous names and codes: entity resolution must never be
// blamed for an ambiguous demo, so nothing here is a near-duplicate.
const PRODUCTS = [
  { sku: 'STL-001', name: 'Steel Rod', category: 'Raw Material', unit_of_measure: 'pcs', min_stock: 20, unit_cost: 450 },
  { sku: 'STL-002', name: 'Steel Plate', category: 'Raw Material', unit_of_measure: 'pcs', min_stock: 15, unit_cost: 820 },
  { sku: 'ALU-001', name: 'Aluminium Sheet', category: 'Raw Material', unit_of_measure: 'pcs', min_stock: 10, unit_cost: 1250 },
  { sku: 'CBL-001', name: 'Copper Cable', category: 'Raw Material', unit_of_measure: 'm', min_stock: 50, unit_cost: 90 },
  { sku: 'BRG-001', name: 'Bearing 6204', category: 'Consumables', unit_of_measure: 'pcs', min_stock: 25, unit_cost: 310 },
  { sku: 'BLT-001', name: 'Hex Bolt M8', category: 'Consumables', unit_of_measure: 'pcs', min_stock: 100, unit_cost: 12 },
  { sku: 'GRK-001', name: 'Grease Tube', category: 'Consumables', unit_of_measure: 'pcs', min_stock: 12, unit_cost: 180 },
  { sku: 'BOX-001', name: 'Carton Box Large', category: 'Packaging', unit_of_measure: 'pcs', min_stock: 40, unit_cost: 35 },
  { sku: 'TAP-001', name: 'Packing Tape', category: 'Packaging', unit_of_measure: 'pcs', min_stock: 30, unit_cost: 45 },
  { sku: 'FIN-001', name: 'Finished Assembly', category: 'Finished Goods', unit_of_measure: 'pcs', min_stock: 5, unit_cost: 3400 },
];

// Opening stock, chosen so the demo has something true to say on first boot:
//   - Steel Rod at Production Rack sits exactly on its reorder level (20 of 20),
//     so transferring 20 in visibly clears a real low-stock warning.
//   - Packing Tape starts genuinely below its reorder level and stays there,
//     so the low-stock panel is never empty even after that transfer clears
//     the first item.
const OPENING = [
  { product: 'Steel Rod', location: 'Main Store', quantity: 120 },
  { product: 'Steel Rod', location: 'Production Rack', quantity: 20 },
  { product: 'Steel Plate', location: 'Main Store', quantity: 60 },
  { product: 'Aluminium Sheet', location: 'Main Store', quantity: 40 },
  { product: 'Copper Cable', location: 'Main Store', quantity: 300 },
  { product: 'Bearing 6204', location: 'Main Store', quantity: 80 },
  { product: 'Hex Bolt M8', location: 'Main Store', quantity: 500 },
  { product: 'Grease Tube', location: 'Main Store', quantity: 24 },
  { product: 'Carton Box Large', location: 'Main Store', quantity: 150 },
  { product: 'Packing Tape', location: 'Main Store', quantity: 25 },
];

async function insertReference() {
  for (const u of USERS) {
    await db
      .prepare('INSERT INTO users (email, password, full_name, role) VALUES (?, ?, ?, ?)')
      .run(u.email, hashPassword(u.password), u.full_name, u.role);
  }

  for (const l of LOCATIONS) {
    await db
      .prepare('INSERT INTO locations (name, type) VALUES (?, ?)')
      .run(l.name, l.type);
  }

  // products.category is a text column, so there is no categories table to seed.
  for (const p of PRODUCTS) {
    await db
      .prepare(
        `INSERT INTO products (sku, name, category, unit_of_measure, min_stock, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(p.sku, p.name, p.category, p.unit_of_measure, p.min_stock, p.unit_cost);
  }
}

/**
 * Opening stock is posted through the engine rather than inserted directly, so
 * the very first rows of the ledger are produced by the same guarded path that
 * every later movement uses. The integrity check is therefore green on a fresh
 * database instead of being special-cased.
 */
async function postOpeningStock() {
  for (const o of OPENING) {
    const product = await db.prepare('SELECT id FROM products WHERE name = ?').get(o.product);
    const location = await db.prepare('SELECT id FROM locations WHERE name = ?').get(o.location);
    const op = await createOperation(
      {
        type: 'receipt',
        destLocationId: location.id,
        reference: `OPENING-${o.product.toUpperCase().replace(/\s+/g, '-')}`,
        notes: 'Opening stock',
        lines: [{ productId: product.id, quantity: o.quantity }],
      },
      'seed'
    );
    await setStatus(op.id, 'ready', 'seed');
    await postOperation(op.id, 'seed');
  }
}

export async function reseed() {
  await resetSchema();
  await insertReference();
  await postOpeningStock();
  return { users: USERS.length, products: PRODUCTS.length, operations: OPENING.length };
}

export async function seedIfEmpty() {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (count.n > 0) return null;
  return reseed();
}

export default seedIfEmpty;
