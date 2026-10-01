import express from 'express';
import { db } from '../db/index.js';

const router = express.Router();

/** GET /api/inventory/products */
router.get('/products', async (req, res) => {
  const products = await db
    .prepare(
      // p.current_stock is the trigger-maintained cache of the same SUM() below.
      // They agreeing is the proof the sync trigger works.
      `SELECT p.*,
              COALESCE(SUM(i.quantity), 0) AS total_quantity,
              COALESCE(SUM(i.reserved), 0) AS total_reserved
         FROM products p
         LEFT JOIN stock_by_location i ON i.product_id = p.id
        WHERE p.active
        GROUP BY p.id
        ORDER BY p.sku`
    )
    .all();
  res.json({ success: true, products });
});

/** POST /api/inventory/products */
router.post('/products', async (req, res) => {
  const {
    sku,
    name,
    category = null,
    unit_of_measure = 'pcs',
    min_stock = 0,
    unit_cost = 0,
  } = req.body ?? {};
  if (!sku || !name) {
    return res.status(400).json({ success: false, message: 'sku and name are required' });
  }
  try {
    // category is a plain text column, matching the team's original schema, so
    // there is no categories table to look up or create.
    const created = await db
      .prepare(
        `INSERT INTO products (sku, name, category, unit_of_measure, min_stock, unit_cost)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(sku, name, category, unit_of_measure, Number(min_stock), Number(unit_cost));
    return res.status(201).json({ success: true, id: created.id });
  } catch (err) {
    return res.status(409).json({ success: false, message: `Could not create product: ${err.message}` });
  }
});

/** GET /api/inventory/locations */
router.get('/locations', async (req, res) => {
  const locations = await db
    .prepare(
      `SELECT l.*, COALESCE(SUM(i.quantity), 0) AS total_quantity
         FROM locations l
         LEFT JOIN stock_by_location i ON i.location_id = l.id
        GROUP BY l.id ORDER BY l.name`
    )
    .all();
  res.json({ success: true, locations });
});

/** GET /api/inventory - balances, with reserved made explicit. */
router.get('/', async (req, res) => {
  const inventory = await db
    .prepare(
      `SELECT i.product_id, i.location_id, i.quantity, i.reserved,
              i.quantity - i.reserved AS available,
              p.sku, p.name AS product_name, p.unit_of_measure, p.min_stock,
              l.name AS location_name, l.type AS location_type
         FROM stock_by_location i
         JOIN products p  ON p.id = i.product_id
         JOIN locations l ON l.id = i.location_id
        ORDER BY p.sku, l.name`
    )
    .all();
  res.json({ success: true, inventory });
});

/** GET /api/inventory/low-stock */
router.get('/low-stock', async (req, res) => {
  // LEFT JOIN ensures products that have never had a stock_by_location row
  // (COALESCE to 0) still appear as out-of-stock rather than being invisible.
  const lowStock = await db
    .prepare(
      `SELECT p.id AS product_id, COALESCE(i.location_id, NULL) AS location_id,
              COALESCE(i.quantity, 0) AS quantity, COALESCE(i.reserved, 0) AS reserved,
              COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0) AS available,
              p.sku, p.name AS product_name, p.unit_of_measure, p.min_stock,
              COALESCE(l.name, 'No Stock Location') AS location_name
         FROM products p
         LEFT JOIN stock_by_location i ON i.product_id = p.id
         LEFT JOIN locations l ON l.id = i.location_id
        WHERE p.active
          AND COALESCE(i.quantity, 0) - COALESCE(i.reserved, 0) < p.min_stock
        ORDER BY available ASC`
    )
    .all();
  res.json({ success: true, lowStock });
});

/** GET /api/inventory/products/:id/locations - per-location stock for a product */
router.get('/products/:id/locations', async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT l.id, l.name, l.type, COALESCE(i.quantity, 0) AS quantity, COALESCE(i.reserved, 0) AS reserved
         FROM locations l
         LEFT JOIN stock_by_location i ON i.location_id = l.id AND i.product_id = ?
        ORDER BY l.name`
    )
    .all(req.params.id);
  res.json({ success: true, locations: rows });
});

export default router;

