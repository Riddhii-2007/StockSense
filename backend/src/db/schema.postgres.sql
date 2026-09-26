-- StockSense schema - PostgreSQL / Supabase
--
-- Built on the team's original config/schema.sql, extended with the pieces the
-- statement needs. Table and column names from the original are preserved so
-- the existing Supabase client and /api/db-test route keep working:
--
--   locations          kept, + warehouse_id / code / type
--   products           kept, + unit_cost / active; current_stock kept but now
--                      maintained by trigger so it cannot drift from the
--                      per-location balances it duplicates
--   stock_by_location  kept, + reserved / updated_at / CHECK constraints
--   stock_ledger       kept, extended into the append-only audit trail
--
-- Added: warehouses, users, operations, operation_items.
--
-- Dropped from my earlier draft: the `categories` table (products.category is a
-- text column in the original, so grouping happens in the query) and the
-- separate `inventory` table (folded into stock_by_location).
--
-- Everything the design depends on:
--   - CHECK (quantity >= 0)          non-negative on-hand, enforced by the DB
--   - CHECK (reserved <= quantity)   reservations can never exceed on-hand
--   - guarded UPDATE                 atomic compare-and-set for stock movement
--   - append-only trigger            the ledger cannot be edited
--   - sync trigger                   products.current_stock never drifts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Warehouses and locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS warehouses (
  id   BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

-- Original shape was (id uuid, name text UNIQUE). Kept, plus the columns the
-- engine needs. uuid is retained for the primary key because stock_by_location
-- and stock_ledger already reference it as uuid.
CREATE TABLE IF NOT EXISTS locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id BIGINT      REFERENCES warehouses(id),
  code         TEXT UNIQUE,
  name         TEXT        NOT NULL UNIQUE,
  type         TEXT        NOT NULL DEFAULT 'STORAGE'
               CHECK (type IN ('STORAGE', 'PRODUCTION', 'QUARANTINE', 'DAMAGED'))
);

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT        NOT NULL UNIQUE,
  password       TEXT        NOT NULL,
  full_name      TEXT        NOT NULL DEFAULT '',
  role           TEXT        NOT NULL DEFAULT 'STAFF'
                 CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF')),
  otp_code       TEXT,
  otp_expires_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

-- `current_stock` duplicates the sum of stock_by_location and the original
-- schema left it free to drift. It is kept because the dashboard and the
-- original /api/db-test route both read it, but sync_product_current_stock()
-- below now owns it: the only way it changes is a stock_by_location write.
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku              TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  category         TEXT,
  unit_of_measure  TEXT        NOT NULL DEFAULT 'pcs',
  min_stock        NUMERIC     NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  current_stock    NUMERIC     NOT NULL DEFAULT 0,
  unit_cost        NUMERIC     NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  active           BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Stock by location
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_by_location (
  product_id  UUID        NOT NULL REFERENCES products(id),
  location_id UUID        NOT NULL REFERENCES locations(id),
  quantity    NUMERIC     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved    NUMERIC     NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id),
  CONSTRAINT reserved_within_onhand CHECK (reserved <= quantity)
);

-- ---------------------------------------------------------------------------
-- Operations: the statement requires five statuses as a filter axis
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS operations (
  id                  BIGSERIAL PRIMARY KEY,
  type                TEXT NOT NULL
                      CHECK (type IN ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT')),
  status              TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED')),
  source_location_id  UUID REFERENCES locations(id),
  dest_location_id    UUID REFERENCES locations(id),
  reference           TEXT,
  notes               TEXT,
  cancel_reason       TEXT,
  created_by          TEXT NOT NULL DEFAULT 'system',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at           TIMESTAMPTZ,
  CONSTRAINT distinct_endpoints
    CHECK (dest_location_id IS NULL OR dest_location_id <> source_location_id)
);

CREATE TABLE IF NOT EXISTS operation_items (
  id           BIGSERIAL PRIMARY KEY,
  operation_id BIGINT  NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   UUID    NOT NULL REFERENCES products(id),
  quantity     NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost    NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0)
);

-- ---------------------------------------------------------------------------
-- Stock ledger: the audit trail
-- ---------------------------------------------------------------------------

-- `quantity` is the SIGNED change (+/-) and is the single source of truth that
-- checkIntegrity() recomputes balances from. `stock_before` / `stock_after` are
-- a stored running balance for display only and are deliberately NOT used by
-- the recompute, because a recompute that validates itself proves nothing.
--
-- One row per location per item: a transfer writes TRANSFER_OUT at the source
-- and TRANSFER_IN at the destination, both under the same operation_id.
CREATE TABLE IF NOT EXISTS stock_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id      BIGINT      REFERENCES operations(id),
  operation_item_id BIGINT      REFERENCES operation_items(id),
  product_id        UUID        NOT NULL REFERENCES products(id),
  location_id       UUID        NOT NULL REFERENCES locations(id),
  operation_type    TEXT        NOT NULL
                    CHECK (operation_type IN
                      ('RECEIPT', 'DELIVERY', 'TRANSFER_OUT', 'TRANSFER_IN',
                       'ADJUSTMENT_IN', 'ADJUSTMENT_OUT')),
  quantity          NUMERIC     NOT NULL,
  stock_before      NUMERIC     NOT NULL,
  stock_after       NUMERIC     NOT NULL,
  reference         TEXT,
  created_by        TEXT        NOT NULL DEFAULT 'system',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_op   ON stock_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_prod ON stock_ledger(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_ops_status  ON operations(status);
CREATE INDEX IF NOT EXISTS idx_ops_type    ON operations(type);
CREATE INDEX IF NOT EXISTS idx_opitems_op  ON operation_items(operation_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- The ledger is the audit trail. Correcting it means posting a reversing entry,
-- never editing history. Enforced by the database, not by convention. The
-- integrity check proves this by attempting an UPDATE and catching the refusal,
-- so the error must propagate rather than be swallowed.
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

-- Done operations are posted history; their items must not be edited either.
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

-- products.current_stock is a cache of SUM(stock_by_location.quantity). The
-- original schema let the app write it by hand, which is how it drifts. Now the
-- only writer is this trigger, so the dashboard total cannot disagree with the
-- per-location balances.
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
