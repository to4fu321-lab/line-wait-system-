-- customers テーブルに保護者名を追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_name text;

-- queues テーブルに保護者フリガナを追加
ALTER TABLE queues ADD COLUMN IF NOT EXISTS customer_kana text;
