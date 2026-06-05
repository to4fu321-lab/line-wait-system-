-- 発注スケジュール設定カラムを stores テーブルに追加
-- type: 'immediate' | 'daily' | 'interval' | 'weekly'
-- time: "HH:MM" (daily/weekly で使用)
-- day_of_week: 0-6 (0=日曜, weekly で使用)
-- interval_days: N (interval で使用)
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS order_schedule JSONB DEFAULT NULL;
