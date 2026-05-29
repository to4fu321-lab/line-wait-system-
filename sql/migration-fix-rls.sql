-- ============================================================
-- RLS・Function Search Path 修正マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- ① RLS を有効化（groups・queues・stores）
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- ② anon ポリシーを追加（groups は未設定だったため追加）
DROP POLICY IF EXISTS "groups_anon_all" ON groups;
CREATE POLICY "groups_anon_all"
  ON groups FOR ALL TO anon USING (true) WITH CHECK (true);

-- queues・stores は既存ポリシーを念のため再作成
DROP POLICY IF EXISTS "stores_anon_update" ON stores;
CREATE POLICY "stores_anon_update"
  ON stores FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "queues_anon_all" ON queues;
CREATE POLICY "queues_anon_all"
  ON queues FOR ALL TO anon USING (true) WITH CHECK (true);

-- ③ Function Search Path Mutable を修正
CREATE OR REPLACE FUNCTION get_next_ticket_number(p_store_id uuid)
RETURNS int
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num int;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO next_num
  FROM queues
  WHERE store_id = p_store_id
    AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date;
  RETURN next_num;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.line_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (
        SELECT 1 FROM customers
        WHERE store_id    = NEW.store_id
          AND line_user_id = NEW.line_user_id
          AND name         = NEW.customer_name
      ) THEN
        UPDATE customers
        SET school_name = NEW.school_name,
            gender      = NEW.gender,
            category    = NEW.category,
            updated_at  = now()
        WHERE store_id    = NEW.store_id
          AND line_user_id = NEW.line_user_id
          AND name         = NEW.customer_name;
      ELSE
        INSERT INTO customers (store_id, name, line_user_id, school_name, gender, category)
        VALUES (NEW.store_id, NEW.customer_name, NEW.line_user_id, NEW.school_name, NEW.gender, NEW.category);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
