-- 依頼番号（request_no）の追加
-- repair_histories と purchase_orders それぞれに店舗ごとの連番を付与

ALTER TABLE repair_histories   ADD COLUMN IF NOT EXISTS request_no INTEGER;
ALTER TABLE purchase_orders    ADD COLUMN IF NOT EXISTS request_no INTEGER;

-- 既存レコードに店舗ごとの連番を付与（received_date / ordered_date 昇順）
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY received_date, created_at) AS rn
  FROM repair_histories
  WHERE request_no IS NULL
)
UPDATE repair_histories r
SET request_no = ranked.rn::INTEGER
FROM ranked
WHERE r.id = ranked.id;

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY ordered_date, created_at) AS rn
  FROM purchase_orders
  WHERE request_no IS NULL
)
UPDATE purchase_orders p
SET request_no = ranked.rn::INTEGER
FROM ranked
WHERE p.id = ranked.id;

-- 新規 INSERT 時に自動採番するトリガー関数
CREATE OR REPLACE FUNCTION assign_repair_request_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_no IS NULL THEN
    SELECT COALESCE(MAX(request_no), 0) + 1 INTO NEW.request_no
    FROM repair_histories
    WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repair_request_no ON repair_histories;
CREATE TRIGGER trg_repair_request_no
  BEFORE INSERT ON repair_histories
  FOR EACH ROW EXECUTE FUNCTION assign_repair_request_no();

CREATE OR REPLACE FUNCTION assign_purchase_request_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_no IS NULL THEN
    SELECT COALESCE(MAX(request_no), 0) + 1 INTO NEW.request_no
    FROM purchase_orders
    WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_request_no ON purchase_orders;
CREATE TRIGGER trg_purchase_request_no
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION assign_purchase_request_no();
