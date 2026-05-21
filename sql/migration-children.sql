-- お子様テーブル
CREATE TABLE IF NOT EXISTS children (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kana        text,
  school_name text,
  grade       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_children_updated_at ON children;
CREATE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON children FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();

ALTER TABLE children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "children_all_anon" ON children;
CREATE POLICY "children_all_anon" ON children FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "children_all_authenticated" ON children;
CREATE POLICY "children_all_authenticated" ON children FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- child_id columns
ALTER TABLE queues           ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);
ALTER TABLE repair_histories ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);
ALTER TABLE purchase_orders  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);

-- Migrate existing customers: create child records from existing name/kana/school_name
INSERT INTO children (customer_id, store_id, name, kana, school_name)
SELECT id, store_id, name, kana, school_name
FROM customers
WHERE name IS NOT NULL AND name NOT IN ('未登録', '')
AND NOT EXISTS (SELECT 1 FROM children ch WHERE ch.customer_id = customers.id);

-- Update customers: if parent_name was set, make that the main name
UPDATE customers
SET name = parent_name, kana = COALESCE(parent_kana, kana)
WHERE parent_name IS NOT NULL AND parent_name != '';
