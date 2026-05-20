-- ============================================================
-- 1つのLINE IDで複数お子様対応
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 旧: store_id + line_user_id のユニーク制約を削除（1人しか登録できなかった）
DROP INDEX IF EXISTS idx_customers_store_line_user_id;

-- 新: store_id + line_user_id + name のユニーク制約（同じ名前の重複防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_line_name
  ON customers(store_id, line_user_id, name) WHERE line_user_id IS NOT NULL;

-- トリガー更新: store_id + line_user_id + name で一致を確認
CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
