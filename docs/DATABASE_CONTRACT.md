# STOCKSENSE DATABASE CONTRACT

> Single source of truth for the StockSense data layer. Do not guess names.
> If a name is not in this document, ask before inventing it.

Architecture: `React Frontend -> Backend/API -> Supabase PostgreSQL -> Inventory Data + Ledger`.
Supabase PostgreSQL is the source of truth for inventory data. The frontend must
never modify stock quantities directly; all mutations go through the backend /
database transaction layer.

---

## A. DATABASE STATUS

**What exists (live Supabase project, verified 2026-09-26 with real queries —
run `node scripts/db-contract-verify.mjs` in `backend/` to reproduce):**

- All four core tables exist and pass the structural contract:
  `products`, `locations`, `stock_by_location`, `stock_ledger`.
- Seed identity verified: `Main Store`, `Production Rack`, product
  `Steel Rods` / sku `STL-001` / category `Raw Material` / uom `kg` /
  min_stock `20`.
- Consistency rule verified live: `products.current_stock` (140) equals
  `SUM(stock_by_location.quantity)` (110 + 30).
- Foreign keys verified (all five contract FKs present, see section D).
- `CHECK (quantity >= 0)` verified by an actual rejected INSERT
  (`violates check constraint "sbl_stock_guards"`), rolled back, nothing written.
- Foreign keys verified by an actual rejected INSERT with an unknown product id
  (`violates foreign key constraint`), rolled back, nothing written.
- `stock_ledger` is append-only (enforced by triggers `ledger_no_update`,
  `ledger_no_delete`).
- RLS is disabled on all tables (per spec: no complicated RLS unless requested).
- Connection is via the Supabase session pooler (`...pooler.supabase.com:5432`).

**Seed drift (IMPORTANT):** the live database is no longer in the pristine seed
state. A real transfer of 10 units was executed after seeding
(`stock_ledger` has 1 row, reference `manual transfer`):

| | Pristine spec seed | Actual live value |
|---|---|---|
| Steel Rods @ Main Store | 120 | **110** |
| Steel Rods @ Production Rack | 20 | **30** |
| products.current_stock | 140 | **140** (still consistent) |
| stock_ledger rows | 0 | **1** |

The drift is a legitimate recorded operation, not corruption: the totals still
reconcile and the ledger explains the change. It was deliberately **not**
rewritten — the ledger is append-only and the database is shared. To restore
the pristine demo state, run the project's own reset flow (`POST /api/demo/reset`
on the backend, or re-run the seed path), never hand-edited SQL.

---

## B. FINAL SCHEMA

Column lists below are EXACTLY as they exist in the live database. Spec columns
come first; additive columns added by later migrations are marked `[added]`
and are safe to ignore by the frontend.

### products
| column | type | constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL |
| sku | text | UNIQUE, NOT NULL |
| category | text | nullable |
| unit_of_measure | text | nullable |
| current_stock | numeric | NOT NULL, default 0, CHECK `>= 0` |
| min_stock | numeric | nullable, default 10 |
| created_at | timestamptz | default `now()` |
| unit_cost `[added]` | numeric | NOT NULL, default 0 |
| active `[added]` | boolean | NOT NULL, default true |

### locations
| column | type | constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | UNIQUE, NOT NULL |
| type `[added]` | text | NOT NULL, default `'STORAGE'` |

### stock_by_location
| column | type | constraints |
|---|---|---|
| product_id | uuid | FK -> products.id, part of composite PK |
| location_id | uuid | FK -> locations.id, part of composite PK |
| quantity | numeric | NOT NULL, default 0, CHECK `>= 0` |
| reserved `[added]` | numeric | NOT NULL, default 0, CHECK `<= quantity` |
| updated_at `[added]` | timestamptz | NOT NULL, default `now()` |

PK: `(product_id, location_id)`.

### stock_ledger
| column | type | constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| product_id | uuid | FK -> products.id |
| operation_type | text | NOT NULL |
| quantity | numeric | NOT NULL |
| stock_before | numeric | NOT NULL |
| stock_after | numeric | NOT NULL |
| from_location_id | uuid | FK -> locations.id, nullable |
| to_location_id | uuid | FK -> locations.id, nullable |
| reference | text | nullable |
| created_at | timestamptz | default `now()` |
| operation_id `[added]` | uuid | FK -> operations.id |
| operation_item_id `[added]` | uuid | FK -> operation_items.id |
| location_id `[added]` | uuid | FK -> locations.id |
| quantity_change `[added]` | numeric | NOT NULL, default 0 |
| created_by `[added]` | text | NOT NULL, default `'system'` |
| seq `[added]` | bigint | insertion-order counter for the audit chain |

Note: the live table also carries `from_stock_before/from_stock_after/
to_stock_before/to_stock_after` (the team's original transfer columns, now
nullable). `stock_before`/`stock_after` are the **total product stock** before
and after the operation. A transfer is represented by ONE ledger row
(`from_location_id` = source, `to_location_id` = destination).

---

## C. SEED DATA

Canonical seed (from `backend/src/config/schema.sql`; the live project was
seeded from the same definitions — actual live values in section A):

**locations**
| id | name |
|---|---|
| *(uuid)* | Main Store |
| *(uuid)* | Production Rack |

**products**
| id | name | sku | category | unit_of_measure | current_stock | min_stock |
|---|---|---|---|---|---|---|
| *(uuid)* | Steel Rods | STL-001 | Raw Material | kg | 140 | 20 |

**stock_by_location**
| product | location | quantity |
|---|---|---|
| Steel Rods | Main Store | 120 |
| Steel Rods | Production Rack | 20 |

**stock_ledger:** empty. The ledger must start with zero rows.

---

## D. RELATIONSHIPS (verified against the live database)

```
stock_by_location.product_id   -> products.id     (stock_by_location_product_id_fkey)
stock_by_location.location_id  -> locations.id    (stock_by_location_location_id_fkey)
stock_ledger.product_id        -> products.id     (stock_ledger_product_id_fkey)
stock_ledger.from_location_id  -> locations.id    (stock_ledger_from_location_id_fkey)
stock_ledger.to_location_id    -> locations.id    (stock_ledger_to_location_id_fkey)
```

Additional (added by later migrations, same pattern):
`stock_ledger.location_id -> locations.id`,
`stock_ledger.operation_id -> operations.id`,
`stock_ledger.operation_item_id -> operation_items.id`.

---

## E. DEVELOPER CONNECTION CONTRACT

**Database tables (use these exact names):**
`products`, `locations`, `stock_by_location`, `stock_ledger`
(also present: `operations`, `operation_items`, `users`).

**Key identifiers:**
- Primary product identifier: `products.id` (uuid)
- Primary SKU identifier: `products.sku` (text, unique)
- Primary location identifier: `locations.id` (uuid)
- Location name lookup: `locations.name` (unique)
- Location quantity lookup: `stock_by_location.product_id` +
  `stock_by_location.location_id` + `stock_by_location.quantity`
- Total stock: `products.current_stock` (database-owned, read-only for callers)
- Reorder threshold: `products.min_stock`
- Ledger identifiers: `stock_ledger.product_id`,
  `stock_ledger.from_location_id`, `stock_ledger.to_location_id`
- Ledger ordering: `stock_ledger.created_at` (and `stock_ledger.seq` for the
  audit chain on the live project)

**Consistency rule (never break it):**
`products.current_stock` must always equal
`SUM(stock_by_location.quantity)` for that product. Neither value is ever
edited by hand; `stock_by_location` writes are the only source of change and a
database trigger maintains the total.

**Atomic transfer function (canonical name):** `perform_internal_transfer`
(see section H).

---

## F. ENVIRONMENT VARIABLES

Names only — values are secrets and must never be committed or sent to the
frontend:

- `SUPABASE_URL` — backend only
- `SUPABASE_SERVICE_ROLE_KEY` — backend only; bypasses RLS; never in React,
  never in frontend env files, never in git
- `DATABASE_URL` — Postgres connection string used by the backend's pg driver
  (via the Supabase session pooler; password must be percent-encoded)
- `DB_DRIVER` — `postgres` when using Supabase/Postgres
- Backend-only supporting names: `PORT`, `NODE_ENV`, `SESSION_SECRET`,
  `PGPOOL_MAX`, `ALLOW_DESTRUCTIVE_RESET` (safety gate for remote resets)

The frontend receives data only through the backend API. If the frontend later
needs direct Supabase reads, that requires a publishable/anon key plus explicit
RLS policies — a separate, explicit decision.

---

## G. FUTURE API CONTRACT


---

## H. ATOMIC TRANSFER DESIGN

The four steps of an internal transfer — source decrement, destination
increment, `products.current_stock` update, ledger insert — must all succeed
or all fail. Two implementations exist in this repo; use ONE per database:

1. **Canonical (fresh projects): `perform_internal_transfer`**
   defined in `backend/src/config/schema.sql`.
   - Parameters: `p_product_id uuid`, `p_from_location_id uuid`,
     `p_to_location_id uuid`, `p_quantity numeric`, `p_reference text DEFAULT NULL`
   - Returns: `jsonb` `{ "ledger_id": uuid, "stock_before": numeric, "stock_after": numeric }`
     (before/after are TOTAL product stock)
   - Validates: quantity > 0, locations exist and differ, product exists,
     sufficient source stock (with `FOR UPDATE` row locks)
   - Updates: both `stock_by_location` rows (upsert on destination),
     `products.current_stock` via the sync trigger
   - Inserts: one `stock_ledger` row (`operation_type='transfer'`)
   - Call from the backend: `supabase.rpc('perform_internal_transfer', {...})`
     or `SELECT perform_internal_transfer($1,$2,$3,$4,$5)`.

2. **Live project: `execute_transfer(p_operation_id uuid) RETURNS uuid`**
   already deployed and wired into the operations workflow
   (see `backend/restore-base.sql`). It validates the operation is a `transfer`
   in `ready` status, moves stock with row locks, writes the ledger row
   (with the four from/to balance columns), and marks the operation `done`.

Per the spec's "do not create multiple competing functions" rule, the
canonical `perform_internal_transfer` was **not** added to the live database,
because `execute_transfer` already occupies that role there. The backend team
should standardise on one name — recommendation: keep `execute_transfer` on
the live project (it is integrated), adopt `perform_internal_transfer` for any
fresh environment, and retire the duplicate once the API layer settles.

The backend also has an application-level transaction layer
(`backend/src/services/engine.js` via `transaction()` in
`backend/src/db/postgres.js`) that performs the same guarded sequence through
`pg` with `BEGIN`/`COMMIT` — that is what the REST endpoints actually call.

---

## I. FILES CREATED / UPDATED

- `backend/src/config/schema.sql` — canonical schema + seed +
  `perform_internal_transfer` (spec-required artifact; idempotent)
- `docs/DATABASE_CONTRACT.md` — this document (single source of truth)
- `backend/scripts/db-contract-verify.mjs` — read-only verification script
  (`node scripts/db-contract-verify.mjs`); proves the contract with real
  queries, including rolled-back negative-stock and bad-FK attempts

Pre-existing database artifacts referenced by this contract (unchanged):
`backend/src/db/migrate.supabase.sql`, `backend/restore-base.sql`,
`backend/src/db/schema.postgres.sql`, `backend/src/db/schema.sql` (SQLite mirror).

---

## J. RISKS / IMPORTANT NOTES

1. **Seed drift is real, not corruption.** Live stock is Main Store 110 /
   Production Rack 30 with 1 ledger row. The totals still reconcile
   (140 = 110 + 30). Reset through the app's reset flow if the pristine demo
   state is needed; never by hand-editing rows (the ledger is append-only).
2. **Never write stock from the frontend.** `products.current_stock` and
   `stock_by_location.quantity` change only through the transaction layer /
   RPC. Direct writes bypass validation and reconciliation.
3. **Service-role key is backend-only.** It bypasses RLS. RLS is currently
   disabled on every table — safe only while every client is the backend.
4. **Schema is a superset of the spec.** Additive columns (`unit_cost`,
   `active`, `reserved`, `updated_at`, `type`, ledger extras, `operations`,
   `operation_items`, `users`) exist and are documented in section B. The four
   spec tables keep their exact spec names and columns; queries that use only
   spec columns work unchanged.
5. **`stock_ledger` is append-only** (enforced by triggers). Corrections are
   reversing entries, never UPDATEs/DELETEs.
6. **Ledger ordering:** `created_at` is not monotonic enough for the audit
   chain on the live project; the audit chain uses `stock_ledger.seq`. For
   simple "recent activity" lists, `created_at DESC` is fine.
7. **numeric comes back as string** from `pg` by default; the backend's driver
   layer parses it. Frontend should treat quantities as numbers, not strings.
8. **Connection pooling:** the project uses the Supabase *session* pooler
   (port 5432). Prepared statements across sessions are not supported there —
   the backend already accounts for this. Do not switch to the transaction
   pooler (6543) without re-testing transactions.
9. **The `verify` suite resets data.** `npm run verify` calls
   `/api/demo/reset`. It is guarded against remote databases
   (`ALLOW_DESTRUCTIVE_RESET`), but never point an unguarded environment at
   the shared Supabase project.

Recommended endpoint names (NOT yet implemented — the backend team builds
these; the frontend builds against these shapes):

| Endpoint | Purpose / expected payload |
|---|---|
| `GET /api/dashboard` | see below |
| `GET /api/products` | list of products: `id, name, sku, category, unit_of_measure, current_stock, min_stock, created_at` |
| `GET /api/locations` | list of locations: `id, name` |
| `GET /api/transfers` | transfer history (from `stock_ledger` / `operations`): `id, product_name, quantity, from_location, to_location, reference, created_at` |
| `GET /api/ledger` | ledger entries: `id, product_id, operation_type, quantity, stock_before, stock_after, from_location_id, to_location_id, reference, created_at` |
| `POST /api/transfers/parse` | input `{ "command": "Move 30 Steel Rods from Main Store to Production Rack" }`; output `{ "operation_type": "transfer", "product_name": "Steel Rods", "quantity": 30, "from_location": "Main Store", "to_location": "Production Rack" }` |
| `POST /api/transfers/confirm` | input `{ "product_id": "...", "from_location_id": "...", "to_location_id": "...", "quantity": 30 }`; executes the atomic transfer and returns the ledger record |

`GET /api/dashboard` should eventually return:
- `total_products` — count from `products`
- `total_stock` — sum of `products.current_stock`
- `low_stock_count` — products where `current_stock <= min_stock`
- `pending_receipts`, `pending_deliveries`, `scheduled_transfers` — from the
  operations layer (status not yet `done`/`canceled`)
- `stock_by_location` — rows of product x location x quantity
- `recent_activity` — latest `stock_ledger` rows with product/location names
- `alerts` — low-stock and integrity alerts

