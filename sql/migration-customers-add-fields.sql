-- ============================================================
-- customers テーブルに学校名・性別・カテゴリを追加
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender      text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS category    text;

-- トリガー関数を更新（学校名・性別・カテゴリも同期）
CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.line_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (
        SELECT 1 FROM customers
        WHERE store_id = NEW.store_id AND line_user_id = NEW.line_user_id
      ) THEN
        UPDATE customers
        SET name        = NEW.customer_name,
            school_name = NEW.school_name,
            gender      = NEW.gender,
            category    = NEW.category,
            updated_at  = now()
        WHERE store_id = NEW.store_id AND line_user_id = NEW.line_user_id;
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
