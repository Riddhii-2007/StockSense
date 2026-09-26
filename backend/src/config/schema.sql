-- ============================================================================
-- StockSense - canonical database schema (Supabase / PostgreSQL)
-- File: backend/src/config/schema.sql
--
-- This is the exact SQL that defines the StockSense database foundation.
-- It is idempotent: safe to run on an empty database and safe to re-run on
-- the existing live project (existing tables are untouched by IF NOT EXISTS).
--
-- THE FOUR CORE TABLES (names and columns are the data contract - never rename):
--   products, locations, stock_by_location, stock_ledger
--
-- Consistency rule (enforced by trigger, not by app code):
--   stock_by_location.quantity  = location-level stock state
--   products.current_stock      = SUM of location-level stock for that product
--
-- Atomic transfers go through ONE function: perform_internal_transfer.
-- Never write stock quantities directly from the frontend.
--
-- NOTE FOR THE CURRENT LIVE PROJECT: the running Supabase database already has
-- an equivalent atomic RPC named execute_transfer (see backend/restore-base.sql
-- and backend/src/db/migrate.supabase.sql). To avoid two competing functions on
-- the same database, apply THIS file's perform_internal_transfer only when
-- provisioning a fresh project, or after the team agrees to retire
-- execute_transfer. Both are documented in docs/DATABASE_CONTRACT.md.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLE 1: products
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  sku             text UNIQUE NOT NULL,
  category        text,
  unit_of_measure text,
  current_stock   numeric NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock       numeric DEFAULT 10,
  created_at      timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TABLE 2: locations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- ---------------------------------------------------------------------------
-- TABLE 3: stock_by_location
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_by_location (
  product_id  uuid REFERENCES products(id),
  location_id uuid REFERENCES locations(id),
  quantity    numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, location_id),
  CONSTRAINT stock_by_location_quantity_check CHECK (quantity >= 0)
);

-- ---------------------------------------------------------------------------
-- TABLE 4: stock_ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid REFERENCES products(id),
  operation_type   text NOT NULL,
  quantity         numeric NOT NULL,
  stock_before     numeric NOT NULL,
  stock_after      numeric NOT NULL,
  from_location_id uuid REFERENCES locations(id),
  to_location_id   uuid REFERENCES locations(id),
  reference        text,
  created_at       timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Consistency trigger: products.current_stock is owned by the database.
-- The ONLY way it changes is a stock_by_location write. This is what keeps
-- "Main Store 120 + Production Rack 20 = current_stock 140" true forever.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sync_product_current_stock() RETURNS trigger AS $$
DECLARE
  target uuid := COALESCE(NEW.product_id, OLD.product_id);
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

-- ---------------------------------------------------------------------------
-- Append-only ledger: history is corrected by a reversing entry, never an edit.
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- SEED DATA (idempotent - running this file twice never duplicates rows)
-- The ledger starts EMPTY. No stock_ledger seed records.
-- ---------------------------------------------------------------------------

INSERT INTO locations (name) VALUES ('Main Store'), ('Production Rack')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (name, sku, category, unit_of_measure, current_stock, min_stock)
VALUES ('Steel Rods', 'STL-001', 'Raw Material', 'kg', 140, 20)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO stock_by_location (product_id, location_id, quantity)
SELECT p.id, l.id, v.quantity
FROM (VALUES
  ('STL-001', 'Main Store',       120),
  ('STL-001', 'Production Rack',   20)
) AS v(sku, location_name, quantity)
JOIN products  p ON p.sku  = v.sku
JOIN locations l ON l.name = v.location_name
ON CONFLICT (product_id, location_id) DO NOTHING;

-- If the product already existed with a drifted total, re-align it once with
-- the seeded per-location balances so the consistency rule starts true.
UPDATE products p
   SET current_stock = COALESCE(
         (SELECT SUM(s.quantity) FROM stock_by_location s WHERE s.product_id = p.id), 0)
 WHERE p.sku = 'STL-001';

-- ---------------------------------------------------------------------------
-- ATOMIC INTERNAL TRANSFER (RPC)
--
-- perform_internal_transfer(
--   p_product_id       uuid    - products.id
--   p_from_location_id uuid    - locations.id (source)
--   p_to_location_id   uuid    - locations.id (destination)
--   p_quantity         numeric - amount to move, must be > 0
--   p_reference        text    - optional free-text reference
-- )
-- RETURNS jsonb:
--   { "ledger_id": <uuid>, "stock_before": <numeric>, "stock_after": <numeric> }
--   where stock_before/stock_after are the TOTAL product stock
--   (products.current_stock) before and after the transfer.
--
-- Validates:  product exists, locations exist and differ, quantity > 0,
--             source has enough stock (row-locked FOR UPDATE).
-- Updates:    source stock_by_location.quantity -= p_quantity
--             destination stock_by_location.quantity += p_quantity (upsert)
--             products.current_stock (via the sync trigger)
-- Inserts:    ONE stock_ledger row describing the whole transfer.
-- Atomicity:  single PL/pgSQL block - any failure rolls back everything.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION perform_internal_transfer(
  p_product_id       uuid,
  p_from_location_id uuid,
  p_to_location_id   uuid,
  p_quantity         numeric,
  p_reference        text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_from_before numeric;
  v_from_after  numeric;
  v_to_before   numeric;
  v_to_after    numeric;
  v_ledger_id   uuid;
BEGIN
  -- 1. Validate inputs
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than zero';
  END IF;
  IF p_from_location_id = p_to_location_id THEN
    RAISE EXCEPTION 'source and destination locations must be different';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM products  WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'product % not found', p_product_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_from_location_id) THEN
    RAISE EXCEPTION 'source location % not found', p_from_location_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_to_location_id) THEN
    RAISE EXCEPTION 'destination location % not found', p_to_location_id;
  END IF;

  -- 2. Lock and read the source row
  SELECT quantity INTO v_from_before
    FROM stock_by_location
   WHERE product_id = p_product_id AND location_id = p_from_location_id
   FOR UPDATE;

  IF v_from_before IS NULL THEN
    RAISE EXCEPTION 'no stock record for product % at source location', p_product_id;
  END IF;
  IF v_from_before < p_quantity THEN
    RAISE EXCEPTION 'insufficient stock at source: have %, need %', v_from_before, p_quantity;
  END IF;

  -- 3. Lock and read the destination row
  SELECT quantity INTO v_to_before
    FROM stock_by_location
   WHERE product_id = p_product_id AND location_id = p_to_location_id
   FOR UPDATE;
  v_to_before := COALESCE(v_to_before, 0);

  -- 4. Move the stock (total is unchanged: current_stock stays constant)
  v_from_after := v_from_before - p_quantity;
  v_to_after   := v_to_before + p_quantity;

  UPDATE stock_by_location
     SET quantity = v_from_after
   WHERE product_id = p_product_id AND location_id = p_from_location_id;

  INSERT INTO stock_by_location (product_id, location_id, quantity)
       VALUES (p_product_id, p_to_location_id, v_to_after)
  ON CONFLICT (product_id, location_id) DO UPDATE
       SET quantity = EXCLUDED.quantity;

  -- 5. One ledger row describing the transfer (stock_before/after = TOTALS)
  INSERT INTO stock_ledger (
    product_id, operation_type, quantity, stock_before, stock_after,
    from_location_id, to_location_id, reference
  ) VALUES (
    p_product_id, 'transfer', p_quantity,
    v_from_before + v_to_before,          -- total before (current_stock)
    v_from_after  + v_to_after,           -- total after  (current_stock)
    p_from_location_id, p_to_location_id, p_reference
  ) RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'ledger_id',    v_ledger_id,
    'stock_before', v_from_before + v_to_before,
    'stock_after',  v_from_after  + v_to_after
  );
END;
$$ LANGUAGE plpgsql;

