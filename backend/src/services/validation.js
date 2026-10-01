import { db } from '../db/index.js';

export const OPERATION_TYPES = ['receipt', 'delivery', 'transfer', 'adjustment'];
export const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'];

/** Lowercase, strip punctuation, collapse whitespace. "Main  Store!" -> "main store" */
function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreMatch(query, candidates) {
  const q = norm(query);
  if (!q) return null;
  for (const c of candidates) {
    const name = norm(c.name);
    const code = norm(c.code);
    
    if (name === q || (code && code === q)) return { row: c, how: 'exact' };
    
    if (name.startsWith(q) || (code && code.startsWith(q))) return { row: c, how: 'prefix' };
    if (q.startsWith(name) || (code && q.startsWith(code))) return { row: c, how: 'prefix' };
    
    if (name.includes(q) || (code && code.includes(q))) return { row: c, how: 'partial' };
    if (q.includes(name) || (code && q.includes(code))) return { row: c, how: 'partial' };
  }
  return null;
}

async function loadProducts() {
  return await db
    .prepare('SELECT id, sku, name, unit_of_measure, min_stock FROM products WHERE active')
    .all();
}

async function loadLocations() {
  // The team's schema has no warehouses table and no location code, just
  // (id, name, type). Entity resolution matches on name, which is unique.
  return await db.prepare('SELECT id, name, type FROM locations').all();
}

/**
 * Resolve a free-text entity (product, SKU or location name/code) to a row.
 * The LLM is expected to call this; it is also safe to call on plain form input.
 */
export async function resolveEntities(input = {}) {
  const products = await loadProducts();
  const locations = await loadLocations();
  const out = { product: null, sourceLocation: null, destLocation: null, unresolved: [] };

  if (input.product != null && String(input.product).trim() !== '') {
    const m = scoreMatch(input.product, products);
    if (m) out.product = { ...m.row, matchedBy: m.how };
    else out.unresolved.push({ field: 'product', value: input.product });
  }
  if (input.sourceLocation != null && String(input.sourceLocation).trim() !== '') {
    const m = scoreMatch(input.sourceLocation, locations);
    if (m) out.sourceLocation = { ...m.row, matchedBy: m.how };
    else out.unresolved.push({ field: 'sourceLocation', value: input.sourceLocation });
  }
  if (input.destLocation != null && String(input.destLocation).trim() !== '') {
    const m = scoreMatch(input.destLocation, locations);
    if (m) out.destLocation = { ...m.row, matchedBy: m.how };
    else out.unresolved.push({ field: 'destLocation', value: input.destLocation });
  }
  return out;
}

async function readInventory(productId, locationId) {
  const row = await db
    .prepare('SELECT quantity, reserved FROM stock_by_location WHERE product_id = ? AND location_id = ?')
    .get(productId, locationId);
  return { quantity: row?.quantity ?? 0, reserved: row?.reserved ?? 0 };
}

/** Normalize raw request lines into positive quantities plus a direction. */
function normalizeLines(rawLines, type) {
  return (Array.isArray(rawLines) ? rawLines : []).map((l, i) => {
    let qty = Number(l.quantity);
    const direction = String(l.direction || '').toUpperCase();
    // ADJUSTMENT lines may be sent signed (e.g. -5) or with an explicit direction.
    if (type === 'adjustment') {
      if (direction === 'OUT' || (direction === '' && qty < 0)) qty = Math.abs(qty);
      return { ...l, quantity: qty, direction: direction === 'OUT' ? 'OUT' : 'IN', line: i + 1 };
    }
    return { ...l, quantity: Math.abs(qty), direction: 'IN', line: i + 1 };
  });
}

/**
 * THE shared validator. /api/operations/preview and /api/operations/:id/commit
 * both call this exact function. There is deliberately no second validation
 * path, so a preview can never say OK while the commit disagrees.
 *
 * Read-only: never writes.
 */
export async function validateOperation(input = {}) {
  const errors = [];
  const warnings = [];
  // operations.operation_type is constrained to lowercase by the database, so
  // incoming values are normalized to lowercase before anything compares them.
  const type = String(input.type || '').toLowerCase();

  if (!OPERATION_TYPES.includes(type)) {
    errors.push(`type must be one of ${OPERATION_TYPES.join(', ')}`);
  }

  const resolved = await resolveEntities(input);
  // A supplied *Id is authoritative; only complain about free text that failed
  // to resolve when no explicit id was given.
  for (const u of resolved.unresolved) {
    if (u.field === 'product' && input.productId) continue;
    if (u.field === 'sourceLocation' && input.sourceLocationId) continue;
    if (u.field === 'destLocation' && input.destLocationId) continue;
    errors.push(`Could not resolve ${u.field} "${u.value}". Check the spelling or pick from the list.`);
  }

  const needsSource = type === 'delivery' || type === 'transfer' || type === 'adjustment';
  const needsDest = type === 'receipt' || type === 'transfer';

  // Explicit IDs win over free-text resolution, so a stored operation can be
  // re-validated on commit using exactly the rows it was created with.
  const sourceId = input.sourceLocationId ?? resolved.sourceLocation?.id ?? null;
  const destId = input.destLocationId ?? resolved.destLocation?.id ?? null;

  const locationById = new Map((await loadLocations()).map((l) => [l.id, l]));
  if (sourceId && !resolved.sourceLocation) {
    resolved.sourceLocation = locationById.get(sourceId) ?? null;
  }
  if (destId && !resolved.destLocation) {
    resolved.destLocation = locationById.get(destId) ?? null;
  }

  if (needsSource && !sourceId) errors.push(`${type} requires a source location.`);
  if (needsDest && !destId) errors.push(`${type} requires a destination location.`);
  if (type === 'transfer' && sourceId && destId && sourceId === destId) {
    errors.push('Source and destination must be different locations.');
  }

  const lines = normalizeLines(input.lines, type);
  if (lines.length === 0) errors.push('Add at least one line item.');

  const impacts = [];
  const products = await loadProducts();
  const byId = new Map(products.map((p) => [p.id, p]));

  // Resolve each line's product once, so the impacts and the normalized
  // payload can never disagree about which product a line refers to.
  const productForLine = new Map();
  for (const line of lines) {
    const productId = line.productId ?? resolved.product?.id ?? null;
    productForLine.set(
      line.line,
      byId.get(productId) ?? products.find((p) => norm(p.name) === norm(line.product)) ?? null
    );
  }

  for (const line of lines) {
    const product = productForLine.get(line.line);
    const qty = line.quantity;

    if (!product) {
      errors.push(`Line ${line.line}: product not found.`);
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push(`Line ${line.line} (${product.name}): quantity must be a positive number.`);
      continue;
    }

    const impactsForLine = [];

    if (sourceId) {
      const before = await readInventory(product.id, sourceId);
      const available = before.quantity - before.reserved;
      const isOutbound =
        type === 'delivery' || type === 'transfer' || (type === 'adjustment' && line.direction === 'OUT');
      if (isOutbound) {
        if (available < qty) {
          errors.push(
            `Insufficient stock at ${resolved.sourceLocation?.name ?? 'source'}: ` +
              `${product.name} has ${available} available (${before.quantity} on hand, ${before.reserved} reserved), ` +
              `needs ${qty}.`
          );
        }
        impactsForLine.push({
          locationId: sourceId,
          locationName: resolved.sourceLocation?.name,
          before: before.quantity,
          after: before.quantity - qty,
          delta: -qty,
        });
      }
    }

    if (destId && type !== 'adjustment') {
      const before = await readInventory(product.id, destId);
      impactsForLine.push({
        locationId: destId,
        locationName: resolved.destLocation?.name,
        before: before.quantity,
        after: before.quantity + qty,
        delta: qty,
      });
    } else if (type === 'adjustment' && sourceId) {
      const before = await readInventory(product.id, sourceId);
      const signed = line.direction === 'OUT' ? -qty : qty;
      if (signed < 0 && before.quantity - before.reserved < qty) {
        errors.push(
          `Adjustment would drive ${product.name} negative at ${resolved.sourceLocation?.name}: ` +
            `only ${before.quantity - before.reserved} available, removing ${qty}.`
        );
      }
      impactsForLine.push({
        locationId: sourceId,
        locationName: resolved.sourceLocation?.name,
        before: before.quantity,
        after: before.quantity + signed,
        delta: signed,
      });
    }

    // Soft signal only. Never blocks: the product is still allowed to go low.
    for (const im of impactsForLine) {
      if (im.after < product.min_stock) {
        warnings.push(
          `${product.name} at ${im.locationName} will fall to ${im.after}, ` +
            `below its reorder level of ${product.min_stock}.`
        );
      }
    }

    impacts.push({ line: line.line, product, quantity: qty, direction: line.direction, locations: impactsForLine });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    resolved,
    impacts,
    normalized: {
      type,
      sourceLocationId: sourceId,
      destLocationId: destId,
      lines: lines
        .filter((l) => productForLine.get(l.line))
        .map((l) => ({
          productId: productForLine.get(l.line).id,
          quantity: l.quantity,
          direction: l.direction,
          unitCost: l.unitCost ?? 0,
        })),
    },
  };
}
