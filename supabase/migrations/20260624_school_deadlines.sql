-- ============================================================
-- 学校別締切日フィールドの追加
-- 学校マスターに「発注締切日」「引渡し完了目標日」を追加
-- ============================================================

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS order_deadline    DATE,
  ADD COLUMN IF NOT EXISTS pickup_deadline   DATE,
  ADD COLUMN IF NOT EXISTS measurement_start DATE,
  ADD COLUMN IF NOT EXISTS measurement_end   DATE;

COMMENT ON COLUMN schools.order_deadline    IS '発注締切日（この日までにメーカーへ発注が必要）';
COMMENT ON COLUMN schools.pickup_deadline   IS '引渡し完了目標日（入学式前に完了させたい日付）';
COMMENT ON COLUMN schools.measurement_start IS '採寸受付開始日';
COMMENT ON COLUMN schools.measurement_end   IS '採寸受付終了日';
