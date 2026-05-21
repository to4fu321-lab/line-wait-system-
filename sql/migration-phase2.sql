-- Phase 2: queues に customer_id (外部キー) を追加
ALTER TABLE queues ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- 既存データはNULL（過去の受付分）。今後の受付には入る。
