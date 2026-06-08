-- ============================================================
-- 採寸機能: children へのカラム追加 + measurements テーブル新規作成
-- ============================================================

-- ── children に採寸関連カラムを追加 ──────────────────────────
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS school_id      uuid REFERENCES schools(id),
  ADD COLUMN IF NOT EXISTS gender         text CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS admission_year int;

CREATE INDEX IF NOT EXISTS idx_children_school_id ON children(school_id);

-- ── 採寸記録テーブル ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS measurements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  child_id        uuid        NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  measured_date   date        NOT NULL DEFAULT CURRENT_DATE,

  -- 体型（身長だけでも可）
  height_cm       numeric(5,1),
  weight_kg       numeric(5,1),
  chest_cm        numeric(5,1),   -- 胸囲
  waist_cm        numeric(5,1),   -- 胴囲
  inseam_cm       numeric(5,1),   -- 股下

  -- 確認済みサイズ（商品ごと）
  -- { "school_product_id": { "variant_id": "uuid", "size_label": "165A", "qty": 1, "memo": "" } }
  confirmed_sizes jsonb       NOT NULL DEFAULT '{}',

  staff_memo      text,
  status          text        NOT NULL DEFAULT 'measured'
                              CHECK (status IN ('measured', 'ordered')),
  order_id        uuid        REFERENCES uniform_orders(id),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_measurements_store ON measurements(store_id);
CREATE INDEX IF NOT EXISTS idx_measurements_child ON measurements(child_id);
CREATE INDEX IF NOT EXISTS idx_measurements_date  ON measurements(store_id, measured_date DESC);

CREATE OR REPLACE FUNCTION update_measurements_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_measurements_updated_at ON measurements;
CREATE TRIGGER trg_measurements_updated_at
  BEFORE UPDATE ON measurements FOR EACH ROW
  EXECUTE FUNCTION update_measurements_updated_at();

ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "measurements_all_anon"          ON measurements;
DROP POLICY IF EXISTS "measurements_all_authenticated" ON measurements;
CREATE POLICY "measurements_all_anon"          ON measurements FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "measurements_all_authenticated" ON measurements FOR ALL TO authenticated USING (true) WITH CHECK (true);
