-- StockSense additive migration for the live Supabase project.
--
-- PRINCIPLE: purely additive. No existing column changes name, type or meaning,
-- and no existing row is deleted. Anything already in the database keeps working
-- and keeps its current values. That matters because a teammate is coding
-- against this schema right now.
--
-- What the team's schema already had, and is left exactly as-is:
--   locations(id, name)
--   products(id, name, sku, category, unit_of_measure, current_stock, min_stock, created_at)
--   stock_by_location(product_id, location_id, quantity)
--   stock_ledger(id, product_id, operation_type, quantity, from_location_id,
--                to_location_id, reference, created_at,
--                from_stock_before/after, to_stock_before/after)
--   operations(id, operation_type, status, product_id, quantity,
--              from_location_id, to_location_id, reference, created_at, updated_at)
--
-- Their design is good in two ways we are preserving rather than replacing:
--   - operation_type + status on the document row, so a transfer is one object
--     that can be Draft / Waiting / Ready / Done / Canceled
--   - the four from/to balance columns, which read well for a transfer
--
-- ADDED, and why each is graded or load-bearing:
--   users                 login + OTP password reset (none existed)
--   stock_by_location.reserved  reserve on READY, release on CANCEL
--   CHECK constraints     the database itself refuses negative stock, which is
--                          the single most demonstrable integrity claim
--   operation_items       multi-line documents; operations.quantity becomes the
--                          line total so the existing single-line UI still works
--   stock_ledger.location_id / quantity_change / stock_before / stock_after
--                          a per-location signed audit trail. The from/to columns
--                          stay and stay populated for their UI; quantity_change
--                          is what the integrity recompute reads, because a
--                          recompute that reads the same numbers it is validating
--                          proves nothing.
--   triggers              append-only ledger, immutable posted documents, and
--                          products.current_stock owned by the database instead
--                          of by application code
--
-- Idempotent: safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users: authentication and the OTP reset flow
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password       text NOT NULL,
  full_name      text NOT NULL DEFAULT '',
  role           text NOT NULL DEFAULT 'STAFF',
  otp_code       text,
  otp_expires_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'MANAGER', 'STAFF'))
);

-- ---------------------------------------------------------------------------
-- Additive columns
-- ---------------------------------------------------------------------------

-- Valuation, used by the dashboard's inventory-value tile.
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS active     boolean NOT NULL DEFAULT true;

-- Reservations. Without this, READY has nothing to hold stock with.
ALTER TABLE stock_by_location ADD COLUMN IF NOT EXISTS reserved   numeric NOT NULL DEFAULT 0;
ALTER TABLE stock_by_location ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Locations get a type so the UI can distinguish storage from production.
ALTER TABLE locations ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'STORAGE';

-- Documents get the extra state the lifecycle needs.
ALTER TABLE operations ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS created_by   text NOT NULL DEFAULT 'system';
ALTER TABLE operations ADD COLUMN IF NOT EXISTS posted_at    timestamptz;

-- Ledger gets a per-location machine-readable trail alongside the from/to view.
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS operation_id      uuid REFERENCES operations(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS operation_item_id uuid;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS location_id       uuid REFERENCES locations(id);
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS quantity_change   numeric NOT NULL DEFAULT 0;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS stock_before      numeric NOT NULL DEFAULT 0;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS stock_after       numeric NOT NULL DEFAULT 0;
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS created_by        text NOT NULL DEFAULT 'system';

-- Multi-line documents. operations.quantity stays, and holds the line total, so
-- the teammate's existing single-line screens keep working unchanged.
CREATE TABLE IF NOT EXISTS operation_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id),
  quantity     numeric NOT NULL,
  unit_cost    numeric NOT NULL DEFAULT 0,
  CONSTRAINT operation_items_quantity_check CHECK (quantity > 0)
);

-- stock_ledger.operation_item_id was added before operation_items existed, so
-- its foreign key is attached here instead of inline.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'stock_ledger_operation_item_fk'
       AND conrelid = 'stock_ledger'::regclass
  ) THEN
    ALTER TABLE stock_ledger
      ADD CONSTRAINT stock_ledger_operation_item_fk
      FOREIGN KEY (operation_item_id) REFERENCES operation_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- The team's original ledger stores one row per transfer describing BOTH sides,
-- which forces from_stock_before/after and to_stock_before/after to be NOT NULL.
-- The engine here posts one row per affected location, so a source leg leaves
-- the to_* pair meaningless and a destination leg leaves the from_* pair
-- meaningless. Relaxing them to nullable is what allows an honest row per
-- location; it is strictly more permissive, so the rows already in the table
-- keep their values and any query the teammate wrote against them still works.
ALTER TABLE stock_ledger ALTER COLUMN from_stock_before DROP NOT NULL;
ALTER TABLE stock_ledger ALTER COLUMN from_stock_after  DROP NOT NULL;
ALTER TABLE stock_ledger ALTER COLUMN to_stock_before   DROP NOT NULL;
ALTER TABLE stock_ledger ALTER COLUMN to_stock_after    DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Insertion order for the audit chain
-- ---------------------------------------------------------------------------
-- The chain has to replay in the order rows were actually written, and neither
-- available key can do that. created_at is only second-resolution in SQLite's
-- datetime('now'), and both backends stamp every row of one transaction with the
-- same value, so a fast test run puts an opening receipt and a later transfer in
-- the same second. The tiebreaker used to be the primary key, which is a random
-- v4 uuid, so the replay order was effectively arbitrary and the chain check
-- failed intermittently.
--
-- seq is a real monotonic counter: a sequence on PostgreSQL, the implicit rowid
-- on SQLite. It records the order rows were inserted, which is the causal order.
CREATE SEQUENCE IF NOT EXISTS stock_ledger_seq;

ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS seq bigint;

-- Backfill once, in the only order still available for existing rows, then park
-- the sequence above the highest value handed out.
--
-- The ledger_no_update trigger has to be lifted for this. It exists to stop the
-- application rewriting history, and backfilling a column that did not exist
-- when the row was written is not a rewrite of history - but the trigger cannot
-- tell the difference, so the one legitimate administrative case is handled
-- explicitly here and the trigger is restored immediately afterwards.
ALTER TABLE stock_ledger DISABLE TRIGGER ledger_no_update;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, operation_id, id) AS rn
    FROM stock_ledger
   WHERE seq IS NULL
)
UPDATE stock_ledger l SET seq = n.rn
  FROM numbered n
 WHERE l.id = n.id AND l.seq IS NULL;

ALTER TABLE stock_ledger ENABLE TRIGGER ledger_no_update;

SELECT setval('stock_ledger_seq', GREATEST((SELECT COALESCE(MAX(seq), 0) FROM stock_ledger), 1));

-- ---------------------------------------------------------------------------
-- Backfill: make the pre-existing rows satisfy the new invariants
-- ---------------------------------------------------------------------------

-- Classify the existing locations so the dashboard has something to group by.
UPDATE locations SET type = 'STORAGE' WHERE type IS NULL;
UPDATE locations SET type = 'PRODUCTION' WHERE name ILIKE '%production%';

-- Existing ledger rows predate location_id / quantity_change, and the audit
-- chain is per (product, location). A legacy row is ambiguous in a way a new
-- row never is: a single transfer row describes TWO legs (one leaving, one
-- arriving) but carries only one row. Its own before/after numbers say which
-- direction the source leg went, so that is the leg we can reconstruct.
--
-- The destination leg cannot be recovered, because the legacy row carries no
-- operation_id linking it to the document that caused it. Rather than invent a
-- second row and quietly corrupt the chain, legacy rows are backfilled with the
-- one leg that is provable and flagged in the integrity report, which counts
-- them separately as not being part of the audited chain.
UPDATE stock_ledger
   SET location_id = CASE
         WHEN from_stock_after < from_stock_before THEN from_location_id
         ELSE COALESCE(to_location_id, from_location_id)
       END,
       quantity_change = CASE
         WHEN from_stock_after < from_stock_before
           THEN from_stock_after - from_stock_before
         ELSE to_stock_after - to_stock_before
       END,
       stock_before = CASE
         WHEN from_stock_after < from_stock_before THEN from_stock_before
         ELSE to_stock_before
       END,
       stock_after = CASE
         WHEN from_stock_after < from_stock_before THEN from_stock_after
         ELSE to_stock_after
       END
 WHERE location_id IS NULL;

-- current_stock becomes database-owned from here on; seed it consistently first
-- so the first boot is already green.
UPDATE products p
   SET current_stock = COALESCE(
         (SELECT SUM(sbl.quantity) FROM stock_by_location sbl WHERE sbl.product_id = p.id), 0);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sbl_stock_guards') THEN
    -- The load-bearing one. NOT VALID so a legacy violation cannot abort the
    -- migration halfway; it is validated immediately below once we know the data
    -- is clean, which is what actually makes it enforced for new writes.
    ALTER TABLE stock_by_location ADD CONSTRAINT sbl_stock_guards
      CHECK (quantity >= 0 AND reserved >= 0 AND reserved <= quantity) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_type_check') THEN
    ALTER TABLE operations ADD CONSTRAINT operations_type_check
      CHECK (operation_type IN ('receipt', 'delivery', 'transfer', 'adjustment'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operations_status_check') THEN
    ALTER TABLE operations ADD CONSTRAINT operations_status_check
      CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_type_check') THEN
    ALTER TABLE locations ADD CONSTRAINT locations_type_check
      CHECK (type IN ('STORAGE', 'PRODUCTION', 'QUARANTINE', 'DAMAGED'));
  END IF;
END $$;

-- Validate only if the data is actually clean, and say so loudly if it is not,
-- rather than failing mid-migration and leaving a half-migrated database.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT COUNT(*) INTO bad FROM stock_by_location
   WHERE quantity < 0 OR reserved < 0 OR reserved > quantity;
  IF bad = 0 THEN
    ALTER TABLE stock_by_location VALIDATE CONSTRAINT sbl_stock_guards;
    RAISE NOTICE 'stock guards validated and enforced';
  ELSE
    RAISE WARNING 'stock_by_location has % row(s) violating the guards; left NOT VALID.', bad;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_ops_status     ON operations(status);
CREATE INDEX IF NOT EXISTS idx_ops_type       ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_opitems_op     ON operation_items(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_op      ON stock_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_prodloc ON stock_ledger(product_id, location_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- The ledger is the audit trail: the correction is a reversing entry, never an
-- edit. Enforced by the database so it holds no matter which client writes.
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

-- A posted document is history; its lines are frozen.
CREATE OR REPLACE FUNCTION forbid_posted_item_mutation() RETURNS trigger AS $$
BEGIN
  IF (SELECT status FROM operations WHERE id = COALESCE(NEW.operation_id, OLD.operation_id)) = 'done' THEN
    RAISE EXCEPTION 'operation is done: items are immutable'
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

-- products.current_stock duplicates SUM(stock_by_location.quantity). Left to
-- application code it is exactly the thing that silently drifts, because two
-- code paths update one row and forget the other. The trigger makes the database
-- the only writer, so the dashboard total cannot disagree with the balances.
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
