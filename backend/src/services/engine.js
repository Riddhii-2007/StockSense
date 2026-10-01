import { db, transaction } from '../db/index.js';
import { validateOperation } from './validation.js';

/**
 * Move stock with a single guarded UPDATE.
 *
 * The guard lives in the WHERE clause, not in a prior SELECT, so the check and
 * the write are one atomic step. Two concurrent deliveries of the last 10 units
 * cannot both succeed: the loser's UPDATE matches zero rows.
 *
 * The CHECK constraint is a second line of defence, not the primary guard.
 */
async function applyDelta(productId, locationId, delta) {
  if (delta < 0) {
    const need = Math.abs(delta);
    const res = await db
      .prepare(
        `UPDATE stock_by_location
            SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ? AND location_id = ?
            AND quantity - reserved >= ?`
      )
      .run(need, productId, locationId, need);
    if (res.changes === 0) return { ok: false, reason: 'insufficient' };
  } else {
    const res = await db
      .prepare(
        `UPDATE stock_by_location
            SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
          WHERE product_id = ? AND location_id = ?`
      )
      .run(delta, productId, locationId);
    if (res.changes === 0) {
      await db
        .prepare(
          `INSERT INTO stock_by_location (product_id, location_id, quantity, reserved)
           VALUES (?, ?, ?, 0)`
        )
        .run(productId, locationId, delta);
    }
  }
  const row = await db
    .prepare('SELECT quantity FROM stock_by_location WHERE product_id = ? AND location_id = ?')
    .get(productId, locationId);
  return { ok: true, resultingBalance: row?.quantity ?? 0 };
}

/** Reserve stock when an outbound operation becomes READY. Guarded the same way. */
async function reserve(productId, locationId, qty) {
  const res = await db
    .prepare(
      `UPDATE stock_by_location
          SET reserved = reserved + ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ? AND location_id = ?
          AND quantity - reserved >= ?`
    )
    .run(qty, productId, locationId, qty);
  return res.changes > 0;
}

async function release(productId, locationId, qty) {
  await db
    .prepare(
      `UPDATE stock_by_location
          SET reserved = CASE WHEN reserved - ? < 0 THEN 0 ELSE reserved - ? END,
              updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ? AND location_id = ?`
    )
    .run(qty, qty, productId, locationId);
}

function movementFor(type, direction) {
  if (type === 'receipt') return 'receipt';
  if (type === 'delivery') return 'delivery';
  if (type === 'transfer') return direction < 0 ? 'transfer' : 'transfer';
  return direction < 0 ? 'adjustment' : 'adjustment';
}

// The team's operations table calls these columns operation_type,
// from_location_id and to_location_id. Aliasing them to the names the rest of
// the service layer already uses keeps the JSON API contract unchanged and
// confines the rename to this one place.
const OP_COLUMNS = `o.id, o.operation_type AS type, o.status,
  o.from_location_id AS source_location_id,
  o.to_location_id AS dest_location_id,
  o.product_id, o.quantity, o.reference, o.notes, o.cancel_reason,
  o.created_by, o.created_at, o.updated_at, o.posted_at`;

/** Read a stored operation back into validator input shape. */
async function loadForValidation(operationId) {
  const op = await db
    .prepare(`SELECT ${OP_COLUMNS} FROM operations o WHERE o.id = ?`)
    .get(operationId);
  if (!op) return null;
  const items = await db
    .prepare(
      `SELECT product_id AS "productId", quantity, unit_cost AS "unitCost"
         FROM operation_items WHERE operation_id = ?`
    )
    .all(operationId);
  return {
    type: op.type,
    sourceLocationId: op.source_location_id,
    destLocationId: op.dest_location_id,
    lines: items,
  };
}

export async function getOperation(id) {
  const op = await db.prepare(`SELECT ${OP_COLUMNS} FROM operations o WHERE o.id = ?`).get(id);
  if (!op) return null;
  const items = await db
    .prepare(
      `SELECT oi.*, p.sku, p.name AS product_name, p.unit_of_measure
         FROM operation_items oi JOIN products p ON p.id = oi.product_id
        WHERE oi.operation_id = ?`
    )
    .all(id);
  return { ...op, items };
}

export async function listOperations({ status, type } = {}) {
  const where = [];
  const params = [];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (type) {
    where.push('o.operation_type = ?');
    params.push(type);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `SELECT o.*,
              fl.name AS source_location_name,
              tl.name AS dest_location_name,
              COALESCE(p.name, (SELECT p2.name FROM operation_items oi2 JOIN products p2 ON p2.id = oi2.product_id WHERE oi2.operation_id = o.id LIMIT 1), 'Multiple Items') AS product_name,
              COALESCE(p.sku, (SELECT p2.sku FROM operation_items oi2 JOIN products p2 ON p2.id = oi2.product_id WHERE oi2.operation_id = o.id LIMIT 1), 'MULTI') AS product_sku,
              COALESCE(NULLIF((SELECT COUNT(*) FROM operation_items oi WHERE oi.operation_id = o.id), 0), CASE WHEN o.product_id IS NOT NULL OR o.quantity > 0 THEN 1 ELSE 0 END) AS line_count,
              COALESCE(NULLIF((SELECT SUM(quantity) FROM operation_items oi WHERE oi.operation_id = o.id), 0), o.quantity, 0) AS total_qty
         FROM operations o
         LEFT JOIN locations fl ON fl.id = o.from_location_id
         LEFT JOIN locations tl ON tl.id = o.to_location_id
         LEFT JOIN products p ON p.id = o.product_id
         ${clause}
        ORDER BY o.created_at DESC, o.id DESC`
    )
    .all(...params);
}

/** Validate and store a new operation. Does NOT move stock. */
export async function createOperation(input, user = 'system') {
  const check = await validateOperation(input);
  if (!check.ok) {
    const err = new Error(check.errors.join(' | '));
    err.status = 422;
    err.details = check;
    throw err;
  }
  const n = check.normalized;
  return transaction(async () => {
    // The team's operations table carries product_id/quantity on the document
    // itself. product_id only applies to a single-line document, but quantity is
    // NOT NULL, so it always holds the document total. operation_items remains
    // the authoritative per-line detail the stock engine posts from.
    const single = n.lines.length === 1 ? n.lines[0] : null;
    const total = n.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
    const created = await db
      .prepare(
        `INSERT INTO operations
           (operation_type, status, from_location_id, to_location_id,
            product_id, quantity, reference, notes, created_by, updated_at)
         VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
      .get(
        n.type,
        n.sourceLocationId ?? null,
        n.destLocationId ?? null,
        single?.productId ?? null,
        total,
        input.reference ?? null,
        input.notes ?? null,
        user,
        new Date().toISOString()
      );
    const operationId = created.id;
    for (const l of n.lines) {
      await db
        .prepare(
          `INSERT INTO operation_items (operation_id, product_id, quantity, unit_cost)
           VALUES (?, ?, ?, ?)`
        )
        .run(operationId, l.productId, l.quantity, l.unitCost ?? 0);
    }
    return getOperation(operationId);
  });
}

/** DRAFT -> WAITING -> READY. READY reserves stock for outbound operations. */
export async function setStatus(operationId, next, user = 'system') {
  const op = await getOperation(operationId);
  if (!op) {
    const err = new Error('Operation not found');
    err.status = 404;
    throw err;
  }
  if (op.status === 'done') {
    const err = new Error('Operation is DONE and cannot change status. Post a reversing adjustment instead.');
    err.status = 409;
    throw err;
  }
  if (op.status === 'canceled') {
    const err = new Error('Operation is CANCELED and cannot change status.');
    err.status = 409;
    throw err;
  }
  const allowed = {
    draft: ['waiting', 'ready', 'canceled'],
    waiting: ['ready', 'canceled'],
    ready: ['done', 'canceled'],
  };
  if (!(allowed[op.status] || []).includes(next)) {
    const err = new Error(`Cannot move from ${op.status} to ${next}.`);
    err.status = 409;
    throw err;
  }

  const outbound = op.type === 'delivery' || op.type === 'transfer' || op.type === 'adjustment';

  if (next === 'ready' && outbound) {
    // Re-validate at the moment of reservation, not at creation time. Stock
    // may have moved since the operation was written.
    const check = await validateOperation(await loadForValidation(operationId));
    if (!check.ok) {
      const err = new Error(check.errors.join(' | '));
      err.status = 422;
      err.details = check;
      throw err;
    }
    await transaction(async () => {
      for (const item of check.impacts) {
        for (const im of item.locations) {
          if (im.delta >= 0) continue;
          const amount = -im.delta;
          if (!(await reserve(item.product.id, im.locationId, amount))) {
            const err = new Error(
              `Cannot reserve ${item.product.name} at ${im.locationName}: ` +
                `only ${im.before} available, needs ${amount}.`
            );
            err.status = 422;
            throw err;
          }
        }
      }
      await db.prepare('UPDATE operations SET status = ? WHERE id = ?').run('ready', operationId);
    });
    return getOperation(operationId);
  }

  await db.prepare('UPDATE operations SET status = ? WHERE id = ?').run(next, operationId);
  return getOperation(operationId);
}

/**
 * READY -> DONE. Re-validates, applies stock, writes the ledger.
 *
 * Re-validation is what makes concurrent use safe: between reservation and
 * posting, another operation may have consumed the balance, so the guard is
 * re-run and the post is rejected if the world has moved underneath it.
 */
export async function postOperation(operationId, user = 'system') {
  const op = await getOperation(operationId);
  if (!op) {
    const err = new Error('Operation not found');
    err.status = 404;
    throw err;
  }
  if (op.status === 'done') {
    const err = new Error('Operation is already DONE.');
    err.status = 409;
    throw err;
  }
  if (op.status === 'canceled') {
    const err = new Error('Operation is CANCELED.');
    err.status = 409;
    throw err;
  }
  // Posting requires READY. Without this, a DRAFT or WAITING operation could
  // move stock, skipping the review step the status model exists to enforce.
  if (op.status !== 'ready') {
    const err = new Error(`Operation must be READY to post. It is currently ${op.status}.`);
    err.status = 409;
    throw err;
  }

  const check = await validateOperation(await loadForValidation(operationId));
  if (!check.ok) {
    const err = new Error(check.errors.join(' | '));
    err.status = 422;
    err.details = check;
    throw err;
  }

  const itemRows = await db
    .prepare('SELECT id, product_id, quantity FROM operation_items WHERE operation_id = ?')
    .all(operationId);

  return transaction(async () => {
    for (const impact of check.impacts) {
      const itemRow = itemRows[impact.line - 1] ?? null;
      for (const im of impact.locations) {
        const res = await applyDelta(impact.product.id, im.locationId, im.delta);
        if (!res.ok) {
          const err = new Error(
            `Insufficient stock: ${impact.product.name} at ${im.locationName} has ${im.before}, needs ${-im.delta}.`
          );
          err.status = 422;
          throw err;
        }
        // One ledger row per affected location, which is what makes the audit
        // chain replayable per (product, location). The team's from_*/to_*
        // columns are filled on the side this row actually represents: a
        // negative change is a departure and fills from_*, a positive change is
        // an arrival and fills to_*. `quantity` stays the unsigned magnitude
        // their rows use, and `quantity_change` carries the signed movement.
        const outbound = im.delta < 0;
        await db
          .prepare(
            `INSERT INTO stock_ledger
               (operation_id, operation_item_id, product_id, location_id, operation_type,
                quantity, quantity_change, stock_before, stock_after,
                from_location_id, to_location_id,
                from_stock_before, from_stock_after, to_stock_before, to_stock_after,
                reference, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            operationId,
            itemRow?.id ?? null,
            impact.product.id,
            im.locationId,
            movementFor(op.type, im.delta),
            Math.abs(im.delta),
            im.delta,
            im.before,
            res.resultingBalance,
            outbound ? im.locationId : null,
            outbound ? null : im.locationId,
            outbound ? im.before : null,
            outbound ? res.resultingBalance : null,
            outbound ? null : im.before,
            outbound ? null : res.resultingBalance,
            op.reference ?? null,
            user
          );
      }
    }

    // Consume exactly what was reserved: every location that lost stock.
    for (const impact of check.impacts) {
      for (const im of impact.locations) {
        if (im.delta < 0) await release(impact.product.id, im.locationId, -im.delta);
      }
    }

    await db
      .prepare(
        `UPDATE operations SET status = 'done', posted_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .run(operationId);

    return getOperation(operationId);
  });
}

/** Cancel a not-yet-posted operation and release any reservation. */
export async function cancelOperation(operationId, reason, user = 'system') {
  const op = await getOperation(operationId);
  if (!op) {
    const err = new Error('Operation not found');
    err.status = 404;
    throw err;
  }
  if (op.status === 'done') {
    const err = new Error('Cannot cancel a DONE operation. Post a reversing adjustment instead.');
    err.status = 409;
    throw err;
  }
  return transaction(async () => {
    if (op.status === 'ready' && op.source_location_id) {
      const items = await db
        .prepare('SELECT product_id, quantity FROM operation_items WHERE operation_id = ?')
        .all(operationId);
      for (const i of items) {
        await release(i.product_id, op.source_location_id, i.quantity);
      }
    }
    await db
      .prepare(
        `UPDATE operations SET status = 'canceled', cancel_reason = ?, created_by = ? WHERE id = ?`
      )
      .run(reason ?? null, user, operationId);
    return getOperation(operationId);
  });
}
