-- ============================================================
-- スタッフ属性の拡張（AI欠員補充・人員最適化の前提）
--   既存 staff 行を壊さず ADD COLUMN IF NOT EXISTS で追加。
-- ============================================================
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tel             text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type text;     -- 正社員/パート/アルバイト
ALTER TABLE staff ADD COLUMN IF NOT EXISTS skill_level     integer;  -- 1-5（接客/採寸の習熟度）
ALTER TABLE staff ADD COLUMN IF NOT EXISTS skills          jsonb DEFAULT '[]'::jsonb;  -- 例 ["採寸","レジ"]
ALTER TABLE staff ADD COLUMN IF NOT EXISTS max_weekly_hours integer; -- 週の労働時間上限
ALTER TABLE staff ADD COLUMN IF NOT EXISTS max_daily_hours  integer; -- 1日の上限
ALTER TABLE staff ADD COLUMN IF NOT EXISTS commute_min      integer; -- 通勤時間（分）店舗間ヘルプ判定に使用
ALTER TABLE staff ADD COLUMN IF NOT EXISTS availability     jsonb DEFAULT '{}'::jsonb;  -- 曜日×時間帯の勤務可否

COMMENT ON COLUMN staff.skills IS 'スキルタグ配列（AI割当・欠員補充のスキル適合に使用）';
COMMENT ON COLUMN staff.availability IS '勤務可能パターン（例 {"mon":["10:00-19:00"],"sun":[]}）';

NOTIFY pgrst, 'reload schema';
