-- 予約に「名前のみ」受付用の customer_name を追加（顧客未登録でも氏名で受付可能に）
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS customer_name text;
