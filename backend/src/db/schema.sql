-- StockSense schema - SQLite mirror of the live Supabase schema.
--
-- Column names and enum values are IDENTICAL to migrate.supabase.sql so the same
-- service code runs on either driver. Only the dialect differs: AUTOINCREMENT vs
-- gen_random_uuid(), TEXT vs timestamptz, RAISE(ABORT) vs plpgsql.
-- If you change a name here, change it there.
--
-- Enum casing matches the team's existing rows: lowercase 'receipt', 'done', etc.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email          TEXT NOT NULL UNIQUE,
  password       TEXT NOT NULL,
  full_name      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'STAFF'
                 CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
  otp_code       TEXT,
  otp_expires_at TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

-- No warehouses table: the team's design has a flat list of locations with a
-- type, and the earlier two-level warehouse/location split added nothing the
-- statement asks for.
CREATE TABLE IF NOT EXISTS locations (
  id   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'STORAGE'
       CHECK (type IN ('STORAGE', 'PRODUCTION', 'QUARANTINE', 'DAMAGED'))
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

-- current_stock duplicates SUM(stock_by_location.quantity). It is kept because
-- the dashboard and /api/db-test read it, and owned by the sync_* triggers below
-- so it cannot drift. min_stock is the reorder threshold (the team's name).
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name            TEXT NOT NULL,
  sku             TEXT NOT NULL UNIQUE,
  category        TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  current_stock   REAL NOT NULL DEFAULT 0,
  min_stock       REAL NOT NULL DEFAULT 0,
  unit_cost       REAL NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- stock_by_location
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_by_location (
  product_id  TEXT NOT NULL REFERENCES products(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  quantity    REAL NOT NULL DEFAULT 0,
  reserved    REAL NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, location_id),
  -- The load-bearing guard: the database itself refuses negative stock and
  -- over-reservation, not just the application.
  CHECK (quantity >= 0 AND reserved >= 0 AND reserved <= quantity)
);

-- ---------------------------------------------------------------------------
-- operations
-- ---------------------------------------------------------------------------

-- Single-line documents keep working through product_id + quantity, which is
-- what the team's existing screens read. Multi-line documents additionally get
-- operation_items rows, and quantity then holds the line total so those screens
-- still show a sensible number.
CREATE TABLE IF NOT EXISTS operations (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  operation_type   TEXT NOT NULL
                   CHECK (operation_type IN ('receipt', 'delivery', 'transfer', 'adjustment')),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled')),
  product_id       TEXT REFERENCES products(id),
  quantity         REAL NOT NULL DEFAULT 0,
  from_location_id TEXT REFERENCES locations(id),
  to_location_id   TEXT REFERENCES locations(id),
  reference        TEXT,
  notes            TEXT,
  cancel_reason    TEXT,
  created_by       TEXT NOT NULL DEFAULT 'system',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  posted_at        TEXT
);

CREATE TABLE IF NOT EXISTS operation_items (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   TEXT NOT NULL REFERENCES products(id),
  quantity     REAL NOT NULL CHECK (quantity > 0),
  unit_cost    REAL NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- stock_ledger
-- ---------------------------------------------------------------------------

-- Two views of the same row, deliberately:
--   from_/to_stock_before/after  the team's shape, reads well for a transfer
--   location_id + quantity_change + stock_before/after
--                                the per-location signed trail that the
--                                integrity recompute reads
-- The recompute must use quantity_change, not the before/after columns, or it
-- would be validating the numbers against themselves.
--
-- Replay order is (operation_id, operation_item_id, location_id): created_at is
-- unusable because every row in a transaction shares one timestamp, and `id` is
-- a uuid on PostgreSQL so ordering by it would be arbitrary.
CREATE TABLE IF NOT EXISTS stock_ledger (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id        TEXT REFERENCES products(id),
  location_id       TEXT REFERENCES locations(id),
  operation_id      TEXT REFERENCES operations(id),
  operation_item_id TEXT REFERENCES operation_items(id),
  operation_type    TEXT NOT NULL,
  quantity          REAL NOT NULL DEFAULT 0,
  quantity_change   REAL NOT NULL DEFAULT 0,
  stock_before      REAL NOT NULL DEFAULT 0,
  stock_after       REAL NOT NULL DEFAULT 0,
  -- The team's original ledger forced all four of these to be NOT NULL by
  -- storing one row per transfer describing both sides. The engine posts one row
  -- per affected location, so a departure leaves to_* meaningless and an arrival
  -- leaves from_* meaningless. Nullable in both backends for the same reason;
  -- see migrate.supabase.sql for the matching PostgreSQL change.
  from_location_id  TEXT REFERENCES locations(id),
  to_location_id    TEXT REFERENCES locations(id),
  from_stock_before REAL,
  from_stock_after  REAL,
  to_stock_before   REAL,
  to_stock_after    REAL,
  reference         TEXT,
  created_by        TEXT NOT NULL DEFAULT 'system',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_status     ON operations(status);
CREATE INDEX IF NOT EXISTS idx_ops_type       ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_opitems_op     ON operation_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_op      ON stock_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_prodloc ON stock_ledger(product_id, location_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Append-only. Correcting history means posting a reversing entry.
CREATE TRIGGER IF NOT EXISTS ledger_no_update
BEFORE UPDATE ON stock_ledger
BEGIN
  SELECT RAISE(ABORT, 'stock_ledger is append-only: UPDATE is forbidden');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete
BEFORE DELETE ON stock_ledger
BEGIN
  SELECT RAISE(ABORT, 'stock_ledger is append-only: DELETE is forbidden');
END;

-- A posted document is history; its lines are frozen.
CREATE TRIGGER IF NOT EXISTS posted_items_no_update
BEFORE UPDATE ON operation_items
WHEN (SELECT status FROM operations WHERE id = operation_items.operation_id) = 'done'
BEGIN
  SELECT RAISE(ABORT, 'operation is done: items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS posted_items_no_delete
BEFORE DELETE ON operation_items
WHEN (SELECT status FROM operations WHERE id = operation_items.operation_id) = 'done'
BEGIN
  SELECT RAISE(ABORT, 'operation is done: items are immutable');
END;

-- products.current_stock is a cache of SUM(stock_by_location.quantity). The
-- Postgres version is the same function in plpgsql.
CREATE TRIGGER IF NOT EXISTS sync_stock_on_insert
AFTER INSERT ON stock_by_location
BEGIN
  UPDATE products
     SET current_stock = COALESCE(
       (SELECT SUM(quantity) FROM stock_by_location WHERE product_id = NEW.product_id), 0)
   WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS sync_stock_on_update
AFTER UPDATE ON stock_by_location
BEGIN
  UPDATE products
     SET current_stock = COALESCE(
       (SELECT SUM(quantity) FROM stock_by_location WHERE product_id = NEW.product_id), 0)
   WHERE id = NEW.product_id;
END;

CREATE TRIGGER IF NOT EXISTS sync_stock_on_delete
AFTER DELETE ON stock_by_location
BEGIN
  UPDATE products
     SET current_stock = COALESCE(
       (SELECT SUM(quantity) FROM stock_by_location WHERE product_id = OLD.product_id), 0)
   WHERE id = OLD.product_id;
END;
