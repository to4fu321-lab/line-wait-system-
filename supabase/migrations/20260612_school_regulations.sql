-- ============================================================
-- 学校規定管理システム
--   1. schools           : 学校マスタ
--   2. school_grades     : 学年マスタ
--   3. school_items      : 学校別用品マスタ
--   4. school_parent_tips: 保護者からの口コミ情報
--   5. coupons           : クーポン管理
--   + Alter customers / children (FK追加)
-- ============================================================

-- ── 1. schools ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  kana         TEXT        NOT NULL DEFAULT '',
  short_name   TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  active       BOOLEAN     NOT NULL DEFAULT true,
  notes        TEXT        NOT NULL DEFAULT '',
  updated_by   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_schools_store ON schools(store_id);
CREATE INDEX IF NOT EXISTS idx_schools_sort  ON schools(store_id, sort_order);

DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── 2. school_grades ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_grades (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_name   TEXT        NOT NULL,
  color_name   TEXT        NOT NULL DEFAULT '',
  color_hex    TEXT        NOT NULL DEFAULT '',
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  updated_by   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_grades_school ON school_grades(school_id);

DROP TRIGGER IF EXISTS trg_school_grades_updated_at ON school_grades;
CREATE TRIGGER trg_school_grades_updated_at
  BEFORE UPDATE ON school_grades FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── 3. school_items ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  required          BOOLEAN     NOT NULL DEFAULT true,
  price_tax_in      INTEGER,
  price_tax_out     INTEGER,
  size_spec         TEXT        NOT NULL DEFAULT '',
  product_code      TEXT        NOT NULL DEFAULT '',
  growth_adjust     BOOLEAN     NOT NULL DEFAULT false,
  washable          TEXT        NOT NULL DEFAULT '',
  avg_qty           NUMERIC(4,1),
  uses_grade_color  BOOLEAN     NOT NULL DEFAULT false,
  grade_color_note  TEXT        NOT NULL DEFAULT '',
  item_notes        TEXT        NOT NULL DEFAULT '',
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  updated_by        TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_items_school ON school_items(school_id);

DROP TRIGGER IF EXISTS trg_school_items_updated_at ON school_items;
CREATE TRIGGER trg_school_items_updated_at
  BEFORE UPDATE ON school_items FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── 4. school_parent_tips ────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_parent_tips (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  store_id     UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_name    TEXT        NOT NULL DEFAULT '',
  tip_text     TEXT        NOT NULL,
  line_uid     TEXT        NOT NULL DEFAULT '',
  approved     BOOLEAN     NOT NULL DEFAULT false,
  updated_by   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tips_school    ON school_parent_tips(school_id);
CREATE INDEX IF NOT EXISTS idx_tips_approved  ON school_parent_tips(approved);

DROP TRIGGER IF EXISTS trg_school_parent_tips_updated_at ON school_parent_tips;
CREATE TRIGGER trg_school_parent_tips_updated_at
  BEFORE UPDATE ON school_parent_tips FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── 5. coupons ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code         TEXT        NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  label        TEXT        NOT NULL DEFAULT '情報投稿ありがとうクーポン',
  discount     TEXT        NOT NULL DEFAULT '500円引き',
  valid_until  DATE,
  issued_to    TEXT        NOT NULL DEFAULT '',
  used         BOOLEAN     NOT NULL DEFAULT false,
  used_at      TIMESTAMPTZ,
  updated_by   TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_line  ON coupons(issued_to);

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ── 6. 既存テーブル変更 ──────────────────────────────────────

-- customers: school_id と updated_by を追加
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS school_id   UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  TEXT NOT NULL DEFAULT '';

-- children.school_id FK: 20260608 マイグレーションでカラムは追加済み
-- schools テーブルが存在しなかったため FK 制約を後付けで追加
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_children_school'
      AND table_name = 'children'
  ) THEN
    ALTER TABLE children
      ADD CONSTRAINT fk_children_school
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE schools             ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_grades       ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_parent_tips  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_all_anon"  ON schools;
DROP POLICY IF EXISTS "schools_all_auth"  ON schools;
CREATE POLICY "schools_all_anon" ON schools FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "schools_all_auth" ON schools FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "school_grades_all_anon" ON school_grades;
DROP POLICY IF EXISTS "school_grades_all_auth" ON school_grades;
CREATE POLICY "school_grades_all_anon" ON school_grades FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "school_grades_all_auth" ON school_grades FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "school_items_all_anon" ON school_items;
DROP POLICY IF EXISTS "school_items_all_auth" ON school_items;
CREATE POLICY "school_items_all_anon" ON school_items FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "school_items_all_auth" ON school_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "school_parent_tips_all_anon" ON school_parent_tips;
DROP POLICY IF EXISTS "school_parent_tips_all_auth" ON school_parent_tips;
CREATE POLICY "school_parent_tips_all_anon" ON school_parent_tips FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "school_parent_tips_all_auth" ON school_parent_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "coupons_all_anon" ON coupons;
DROP POLICY IF EXISTS "coupons_all_auth" ON coupons;
CREATE POLICY "coupons_all_anon" ON coupons FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "coupons_all_auth" ON coupons FOR ALL TO authenticated USING (true) WITH CHECK (true);
