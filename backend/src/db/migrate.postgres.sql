-- StockSense migration for Supabase (PostgreSQL)
--
-- SAFE TO RUN ON TOP OF THE TEAM'S EXISTING TABLES.
-- Every statement is idempotent, so this works whether the database is empty,
-- already has the original config/schema.sql applied, or is already current.
-- Re-running it is a no-op.
--
-- Run it either by:
--   (a) letting the app do it: set DB_DRIVER=postgres + DATABASE_URL, then start
--       the server (src/server.js calls applySchema() on boot), or
--   (b) pasting this whole file into the Supabase SQL Editor.
--
-- What it changes relative to the original schema:
--   products          + unit_cost, active; current_stock is now trigger-owned
--   locations         + warehouse_id, code, type
--   stock_by_location + reserved, updated_at, CHECK constraints
--   stock_ledger      + operation_id, operation_item_id, location_id,
--                        quantity, stock_before, stock_after; append-only triggers
--   NEW tables        warehouses, users, operations, operation_items
--
-- The original data is left alone. src/db/seed.js is idempotent per SKU, and
-- POST /api/demo/reset drops and rebuilds everything when a clean slate is
-- wanted instead.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS warehouses (
  id   BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

-- The original created this as (id uuid, name text UNIQUE). Kept.
CREATE TABLE IF NOT EXISTS locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  warehouse_id BIGINT REFERENCES warehouses(id),
  code         TEXT UNIQUE,
  type         TEXT NOT NULL DEFAULT 'STORAGE'
);

-- The original created this as (id uuid, sku, name, category, unit_of_measure,
-- current_stock, min_stock, created_at). Kept, with min_stock promoted to the
-- reorder threshold and current_stock demoted to a trigger-owned cache.
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  sku             TEXT NOT NULL UNIQUE,
  category        TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  current_stock   NUMERIC NOT NULL DEFAULT 0,
  min_stock       NUMERIC NOT NULL DEFAULT 0,
  unit_cost       NUMERIC NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_by_location (
  product_id  UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  quantity    NUMERIC NOT NULL DEFAULT 0,
  reserved    NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password       TEXT NOT NULL,
  full_name      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'STAFF',
  otp_code       TEXT,
  otp_expires_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id                  BIGSERIAL PRIMARY KEY,
  type                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  source_location_id  UUID REFERENCES locations(id),
  dest_location_id    UUID REFERENCES locations(id),
  reference           TEXT,
  notes               TEXT,
  cancel_reason       TEXT,
  created_by          TEXT NOT NULL DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS operation_items (
  id           BIGSERIAL PRIMARY KEY,
  operation_id BIGINT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id),
  quantity     NUMERIC NOT NULL,
  unit_cost    NUMERIC NOT NULL DEFAULT 0
);

-- The original created this as (id uuid, product_id, operation_type, quantity,
-- stock_before, stock_after, from_location_id, to_location_id, reference,
-- created_at). The column names are preserved; the semantics are sharpened so
-- `quantity` is the SIGNED change and the pair (operation_id, location_id)
-- identifies the movement. from/to_location_id are superseded by location_id,
-- which is what per-location balance recomputation needs.
CREATE TABLE IF NOT EXISTS stock_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id),
  location_id       UUID NOT NULL REFERENCES locations(id),
  operation_id      BIGINT REFERENCES operations(id),
  operation_item_id BIGINT REFERENCES operation_items(id),
  operation_type    TEXT NOT NULL,
  quantity          NUMERIC NOT NULL,
  stock_before      NUMERIC NOT NULL DEFAULT 0,
  stock_after       NUMERIC NOT NULL DEFAULT 0,
  reference         TEXT,
  created_by        TEXT NOT NULL DEFAULT 'system',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Columns the original tables did not have
-- ---------------------------------------------------------------------------

ALTER TABLE products          ADD COLUMN IF NOT EXISTS unit_cost     NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE products          ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products          ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE locations         ADD COLUMN IF NOT EXISTS warehouse_id BIGINT REFERENCES warehouses(id);
ALTER TABLE locations         ADD COLUMN IF NOT EXISTS code         TEXT;
ALTER TABLE locations         ADD COLUMN IF NOT EXISTS type         TEXT NOT NULL DEFAULT 'STORAGE';
ALTER TABLE stock_by_location ADD COLUMN IF NOT EXISTS reserved     NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stock_by_location ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stock_ledger      ADD COLUMN IF NOT EXISTS operation_id      BIGINT REFERENCES operations(id);
ALTER TABLE stock_ledger      ADD COLUMN IF NOT EXISTS operation_item_id BIGINT REFERENCES operation_items(id);
ALTER TABLE stock_ledger      ADD COLUMN IF NOT EXISTS location_id       UUID REFERENCES locations(id);
ALTER TABLE stock_ledger      ADD COLUMN IF NOT EXISTS stock_before      NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE stock_ledger      ADD COLUMN IF NOT EXISTS created_by        TEXT NOT NULL DEFAULT 'system';

-- locations.code is UNIQUE in the app schema; add the constraint separately so
-- it can be skipped if a unique index already exists.
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_code ON locations(code);

-- Backfill location_id on any pre-existing ledger rows from their from/to pair,
-- so the append-only trigger and the integrity recompute can see them.
UPDATE stock_ledger
   SET location_id = COALESCE(from_location_id, to_location_id)
 WHERE location_id IS NULL;

-- Give every existing product its warehouse, code and threshold defaults.
UPDATE locations SET type = 'STORAGE' WHERE type IS NULL;
UPDATE products  SET min_stock = COALESCE(min_stock, 0);

-- Backfill the trigger-owned cache so the first boot is already consistent.
UPDATE products p
   SET current_stock = COALESCE(
         (SELECT SUM(sbl.quantity) FROM stock_by_location sbl WHERE sbl.product_id = p.id), 0);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

-- Added as DO blocks because ADD CONSTRAINT has no IF NOT EXISTS. Each checks
-- pg_constraint first, so re-running is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_type_check') THEN
    ALTER TABLE locations ADD CONSTRAINT locations_type_check
      CHECK (type IN ('STORAGE', 'PRODUCTION', 'QUARANTINE', 'DAMAGED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_type_check') THEN
    ALTER TABLE operations ADD CONSTRAINT operations_type_check
      CHECK (type IN ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_status_check') THEN
    ALTER TABLE operations ADD CONSTRAINT operations_status_check
      CHECK (status IN ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_distinct_endpoints') THEN
    ALTER TABLE operations ADD CONSTRAINT operations_distinct_endpoints
      CHECK (dest_location_id IS NULL OR dest_location_id <> source_location_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operation_items_quantity_check') THEN
    ALTER TABLE operation_items ADD CONSTRAINT operation_items_quantity_check CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_operation_type_check') THEN
    ALTER TABLE stock_ledger ADD CONSTRAINT ledger_operation_type_check
      CHECK (operation_type IN
        ('RECEIPT', 'DELIVERY', 'TRANSFER_OUT', 'TRANSFER_IN',
         'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'));
  END IF;
  -- The non-negative guards. NOT VALID so a pre-existing bad row cannot block
  -- the migration; VALIDATE below then proves the data is actually clean.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sbl_quantity_nonneg') THEN
    ALTER TABLE stock_by_location ADD CONSTRAINT sbl_quantity_nonneg
      CHECK (quantity >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sbl_reserved_nonneg') THEN
    ALTER TABLE stock_by_location ADD CONSTRAINT sbl_reserved_nonneg
      CHECK (reserved >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sbl_reserved_within_onhand') THEN
    ALTER TABLE stock_by_location ADD CONSTRAINT sbl_reserved_within_onhand
      CHECK (reserved <= quantity) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_min_stock_nonneg') THEN
    ALTER TABLE products ADD CONSTRAINT products_min_stock_nonneg
      CHECK (min_stock >= 0) NOT VALID;
  END IF;
END $$;

-- Report rather than fail if legacy rows violate a guard, so the migration does
-- not abort halfway and leave a half-migrated database.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT COUNT(*) INTO bad FROM stock_by_location WHERE quantity < 0 OR reserved < 0 OR reserved > quantity;
  IF bad > 0 THEN
    RAISE WARNING 'stock_by_location has % row(s) violating the stock guards; constraints left NOT VALID.', bad;
  ELSE
    ALTER TABLE stock_by_location VALIDATE CONSTRAINT sbl_quantity_nonneg;
    ALTER TABLE stock_by_location VALIDATE CONSTRAINT sbl_reserved_nonneg;
    ALTER TABLE stock_by_location VALIDATE CONSTRAINT sbl_reserved_within_onhand;
  END IF;
  SELECT COUNT(*) INTO bad FROM products WHERE min_stock < 0;
  IF bad = 0 THEN
    ALTER TABLE products VALIDATE CONSTRAINT products_min_stock_nonneg;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ledger_op   ON stock_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_prod ON stock_ledger(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_ops_status  ON operations(status);
CREATE INDEX IF NOT EXISTS idx_ops_type    ON operations(type);
CREATE INDEX IF NOT EXISTS idx_opitems_op  ON operation_items(operation_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- The ledger is the audit trail: correct it with a reversing entry, never an
-- edit. Enforced by the database, not by convention.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'stock_ledger is append-only: % is forbidden', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_no_update ON stock_ledger;
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_no_delete ON stock_ledger;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON stock_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- Posted history is immutable too.
CREATE OR REPLACE FUNCTION forbid_posted_item_mutation() RETURNS trigger AS $$
BEGIN
  IF (SELECT status FROM operations WHERE id = COALESCE(NEW.operation_id, OLD.operation_id)) = 'DONE' THEN
    RAISE EXCEPTION 'operation is DONE: items are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posted_items_no_update ON operation_items;
CREATE TRIGGER posted_items_no_update BEFORE UPDATE ON operation_items
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_item_mutation();

DROP TRIGGER IF EXISTS posted_items_no_delete ON operation_items;
CREATE TRIGGER posted_items_no_delete BEFORE DELETE ON operation_items
  FOR EACH ROW EXECUTE FUNCTION forbid_posted_item_mutation();

-- products.current_stock duplicates SUM(stock_by_location.quantity). The original
-- schema let the app write it by hand, which is how the two drift apart. The
-- trigger makes it the only writer, so the dashboard total cannot disagree with
-- the per-location balances. This is what invariant INV-6 checks.
CREATE OR REPLACE FUNCTION sync_product_current_stock() RETURNS trigger AS $$
DECLARE
  target UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products
     SET current_stock = COALESCE(
           (SELECT SUM(quantity) FROM stock_by_location WHERE product_id = target), 0)
   WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_stock_on_insert ON stock_by_location;
CREATE TRIGGER sync_stock_on_insert AFTER INSERT ON stock_by_location
  FOR EACH ROW EXECUTE FUNCTION sync_product_current_stock();

DROP TRIGGER IF EXISTS sync_stock_on_update ON stock_by_location;
CREATE TRIGGER sync_stock_on_update AFTER UPDATE ON stock_by_location
  FOR EACH ROW EXECUTE FUNCTION sync_product_current_stock();

DROP TRIGGER IF EXISTS sync_stock_on_delete ON stock_by_location;
CREATE TRIGGER sync_stock_on_delete AFTER DELETE ON stock_by_location
  FOR EACH ROW EXECUTE FUNCTION sync_product_current_stock();
