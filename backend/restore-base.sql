-- StockSense Master Database Schema + Seed Data

-- 1. Locations table
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- 2. Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  category text,
  unit_of_measure text,
  current_stock numeric NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock numeric DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

-- 3. Stock by location
CREATE TABLE IF NOT EXISTS stock_by_location (
  product_id uuid REFERENCES products(id),
  location_id uuid REFERENCES locations(id),
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (product_id, location_id)
);

-- 4. Operations table
CREATE TABLE IF NOT EXISTS operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type IN ('receipt', 'delivery', 'transfer', 'adjustment')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled')),
  product_id uuid REFERENCES products(id),
  quantity numeric NOT NULL CHECK (quantity > 0),
  from_location_id uuid REFERENCES locations(id),
  to_location_id uuid REFERENCES locations(id),
  reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Stock ledger for audit trail
CREATE TABLE IF NOT EXISTS stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  operation_type text NOT NULL,
  quantity numeric NOT NULL,
  from_stock_before numeric NOT NULL,
  from_stock_after numeric NOT NULL,
  to_stock_before numeric NOT NULL,
  to_stock_after numeric NOT NULL,
  from_location_id uuid REFERENCES locations(id),
  to_location_id uuid REFERENCES locations(id),
  reference text,
  created_at timestamptz DEFAULT now()
);

-- 6. Atomic execute_transfer RPC function
CREATE OR REPLACE FUNCTION execute_transfer(
  p_operation_id uuid
) RETURNS uuid AS $$
DECLARE
  v_op RECORD;
  v_from_before numeric;
  v_from_after numeric;
  v_to_before numeric;
  v_to_after numeric;
  v_ledger_id uuid;
BEGIN
  -- 1. Fetch & lock operation row
  SELECT * INTO v_op
  FROM operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operation % not found', p_operation_id;
  END IF;

  IF v_op.status != 'ready' THEN
    RAISE EXCEPTION 'Operation % is in status "%", expected "ready"', p_operation_id, v_op.status;
  END IF;

  IF v_op.operation_type != 'transfer' THEN
    RAISE EXCEPTION 'Operation % is type "%", expected "transfer"', p_operation_id, v_op.operation_type;
  END IF;

  -- 2. Verify basic parameters
  IF v_op.quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF v_op.from_location_id = v_op.to_location_id THEN
    RAISE EXCEPTION 'Source and destination locations must be different';
  END IF;

  -- 3. Lock & read source stock row
  SELECT quantity INTO v_from_before
  FROM stock_by_location
  WHERE product_id = v_op.product_id AND location_id = v_op.from_location_id
  FOR UPDATE;

  IF v_from_before IS NULL THEN
    RAISE EXCEPTION 'No stock record found for product at source location';
  END IF;

  IF v_from_before < v_op.quantity THEN
    RAISE EXCEPTION 'Not enough stock at source location: have %, need %', v_from_before, v_op.quantity;
  END IF;

  -- 4. Lock & read destination stock row
  SELECT quantity INTO v_to_before
  FROM stock_by_location
  WHERE product_id = v_op.product_id AND location_id = v_op.to_location_id
  FOR UPDATE;

  IF v_to_before IS NULL THEN
    v_to_before := 0;
  END IF;

  -- 5. Calculate stock levels
  v_from_after := v_from_before - v_op.quantity;
  v_to_after := v_to_before + v_op.quantity;

  -- 6. Decrease source stock
  UPDATE stock_by_location
  SET quantity = v_from_after
  WHERE product_id = v_op.product_id AND location_id = v_op.from_location_id;

  -- 7. Increase destination stock
  INSERT INTO stock_by_location (product_id, location_id, quantity)
  VALUES (v_op.product_id, v_op.to_location_id, v_to_after)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = v_to_after;

  -- 8. Insert stock_ledger audit record using four explicit before/after values
  INSERT INTO stock_ledger (
    product_id,
    operation_type,
    quantity,
    from_stock_before,
    from_stock_after,
    to_stock_before,
    to_stock_after,
    from_location_id,
    to_location_id,
    reference
  ) VALUES (
    v_op.product_id,
    'transfer',
    v_op.quantity,
    v_from_before,
    v_from_after,
    v_to_before,
    v_to_after,
    v_op.from_location_id,
    v_op.to_location_id,
    COALESCE(v_op.reference, 'TRANSFER_EXECUTION')
  ) RETURNING id INTO v_ledger_id;

  -- 9. Update operation status to DONE
  UPDATE operations
  SET status = 'done', updated_at = now()
  WHERE id = p_operation_id;

  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql;
