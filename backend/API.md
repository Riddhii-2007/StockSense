# StockSense API Contract

Base URL: `http://localhost:5000/api`

Every response is JSON. Success and failure both carry `success: boolean`.
On failure, `message` is human-readable and safe to show directly to a user.

**The server is running and verified (59/59 end-to-end checks). Build against this, not against a mock.**

---

## Rule that matters most

> `/operations/preview` and `/operations/:id/post` call the **same** `validateOperation()` function on the server.
> A preview can never say OK while the commit refuses. If they ever disagree, that is a bug.

So the UI flow is always: **preview → show the user → confirm → post.** Never compute stock in the browser.

---

## Auth

### `POST /auth/login`
```json
{ "email": "admin@stocksense.com", "password": "admin123" }
```
→ `200 { success, user: { id, email, fullName, role }, token }` · `401` on bad credentials

### `GET /auth/demo-users`
→ `200 { success, users: [{ email, full_name, role }] }` — list these on the sign-in screen for the demo.

### `POST /auth/request-otp`
```json
{ "email": "admin@stocksense.com" }
```
→ `200 { success, message, demoOtp: "123456" }`

`demoOtp` is returned because no mail provider is wired up. Show it on screen. It is forced off when `NODE_ENV=production`.

### `POST /auth/reset-password`
```json
{ "email": "admin@stocksense.com", "otp": "123456", "newPassword": "newpassword123" }
```
→ `200 { success, message }` · `400` on wrong/expired code or a password under 8 characters

### Seeded logins
| Email | Password | Role |
|---|---|---|
| `admin@stocksense.com` | `admin123` | ADMIN |
| `manager@stocksense.com` | `manager123` | MANAGER |
| `staff@stocksense.com` | `staff123` | STAFF |

---

## Dashboard

### `GET /dashboard`
→ `200` with `stats` (totalProducts, totalLocations, inventoryValue, lowStockCount, pendingOps), `byStatus`, `byType`, `lowStock[]`, `recent[]`, and `integrity: { ok, checkedAt, ledgerEntries }`.

Put `integrity.ok` in the top bar as a live badge.

---

## Products, locations, stock

| Endpoint | Returns |
|---|---|
| `GET /inventory/products` | `products[]` with `sku, name, category, unit, reorder_level, unit_cost, total_quantity, total_reserved` |
| `POST /inventory/products` | `{ sku, name, category?, unit?, reorder_level?, unit_cost? }` → `201` |
| `GET /inventory/locations` | `locations[]` with `id, code, name, type, warehouse, total_quantity` |
| `GET /inventory` | `inventory[]` with `quantity, reserved, available, product_name, location_name` |
| `GET /inventory/low-stock` | `lowStock[]` where `available <= reorder_level` |

`available = quantity - reserved`. **Always show `available`, not `quantity`** — reserved stock is spoken for.

---

## Operations

Types: `RECEIPT` `DELIVERY` `TRANSFER` `ADJUSTMENT`
Statuses: `DRAFT` `WAITING` `READY` `DONE` `CANCELED`

| Type | Source | Destination |
|---|---|---|
| `RECEIPT` | — | required |
| `DELIVERY` | required | — |
| `TRANSFER` | required | required, must differ |
| `ADJUSTMENT` | required (the location) | — |

### `POST /operations/preview` — dry run, writes nothing
Accepts free text or structured input. Same shape either way:
```json
{
  "type": "TRANSFER",
  "sourceLocation": "Main Store",
  "destLocation": "Production Rack",
  "lines": [{ "product": "Steel Rod", "quantity": 20 }]
}
```
`sourceLocation`/`destLocation`/`product` accept a name or a code, case- and spacing-insensitive.

→ `200` when valid:
```json
{
  "success": true,
  "message": "Preview OK. Nothing was written.",
  "ok": true,
  "errors": [],
  "warnings": ["Steel Rod at Production Rack will fall to 5, below its reorder level of 20."],
  "impacts": [{
    "line": 1,
    "product": { "id": 1, "sku": "STL-001", "name": "Steel Rod", "unit": "pcs", "reorder_level": 20 },
    "quantity": 20,
    "locations": [
      { "locationId": 1, "locationName": "Main Store",     "before": 120, "after": 100, "delta": -20 },
      { "locationId": 2, "locationName": "Production Rack", "before": 20,  "after": 40,  "delta": 20 }
    ]
  }]
}
```
→ `422` when blocked, with `message` set to the first real reason:
> `Insufficient stock at Main Store: Steel Rod has 120 available (120 on hand, 0 reserved), needs 9999.`

**Render `impacts[].locations` as the before/after table. That is the demo.**

### `POST /operations` — create, still moves no stock
Same body as preview, plus `reference`, `notes`, `autoReady`.
→ `201 { success, message, operation }`. Status is `READY` unless `autoReady: false`, which leaves it `DRAFT`.

Creating to `READY` **reserves** the source stock. On-hand is unchanged; `reserved` goes up.

### `POST /operations/:id/post` — READY → DONE. The only call that moves stock.
→ `200 { success, message, operation }` · `409` if not `READY` · `422` if stock is gone

### `POST /operations/:id/status`
`{ "status": "WAITING" | "READY" | "DONE" | "CANCELED", "reason"?: string }`
Legal moves: `DRAFT → WAITING|READY|CANCELED`, `WAITING → READY|CANCELED`, `READY → DONE|CANCELED`.
Anything else → `409`.

### `POST /operations/:id/cancel`
`{ "reason": "Duplicate request" }` → releases any reservation. `409` if already `DONE`.

### `GET /operations?status=&type=` · `GET /operations/:id` · `GET /operations/meta`
`meta` returns the `types` and `statuses` arrays for filter dropdowns.

---

## Natural language

### `POST /parse`
```json
{ "text": "transfer 20 Steel Rod from Main Store to Production Rack" }
```
→ `200`
```json
{
  "success": true,
  "intent": {
    "type": "TRANSFER", "quantity": 20, "product": "Steel Rod",
    "sourceLocation": "Main Store", "destLocation": "Production Rack",
    "direction": null, "confidence": 1, "parser": "rules"
  },
  "validation": { "...same shape as /operations/preview..." },
  "note": "Model output is untrusted input..."
}
```

**This endpoint never writes.** Show the user the `validation.impacts` table, require a click to confirm, then call `/operations` and `/operations/:id/post`.

`parser` is `"rules"` (deterministic, always available) or `"claude"` (used when `ANTHROPIC_API_KEY` is set and the rules score below 0.8 confidence). Both produce the same shape, so the UI does not care which ran.

Phrasings that work with no API key:
- `transfer 20 Steel Rod from Main Store to Production Rack`
- `receive 50 Hex Bolt M8 into Main Store`
- `deliver 10 Bearing 6204 from Main Store`
- `adjust Packing Tape at Main Store by -5`

---

## Ledger and integrity

### `GET /ledger?productId=&locationId=&limit=`
`entries[]` newest first, with `movement_type, quantity_change, resulting_balance, product_name, location_name, operation_type, reference, created_by, created_at`.

### `GET /integrity`
Recomputes every balance from the ledger and compares to the inventory table.
```json
{
  "success": true, "ok": true,
  "ledgerEntries": 14,
  "invariants": [
    { "id": "INV-1", "name": "On-hand balance equals the sum of ledger entries", "passed": true, "detail": "0 discrepancies" },
    { "id": "INV-2", "name": "No location holds a negative on-hand quantity", "passed": true, "detail": "0 violation(s)" },
    { "id": "INV-3", "name": "Reserved quantity never exceeds on-hand quantity", "passed": true, "detail": "0 violation(s)" },
    { "id": "INV-4", "name": "Stored running balance matches a running sum of quantity changes", "passed": true, "detail": "0 break(s) across 14 entries" },
    { "id": "INV-5", "name": "Every ledger entry belongs to a posted (DONE) operation", "passed": true, "detail": "0 orphan entry/entries" }
  ],
  "immutableLedger": { "ok": true, "attempted": true, "refusedWith": "ledger_entries is append-only: UPDATE is forbidden" },
  "discrepancies": []
}
```

`immutableLedger` actively attempts an `UPDATE` on the ledger inside a rolled-back savepoint and reports that the database refused it. That is the honest answer to *"can the ledger be edited?"*

---

## Demo helper

### `POST /demo/reset`
Rebuilds the database from seed. Returns `403` when `NODE_ENV=production`.

**Wire a "Reset demo data" button to this.** It is the only insurance if a rehearsal run leaves bad numbers on screen.
