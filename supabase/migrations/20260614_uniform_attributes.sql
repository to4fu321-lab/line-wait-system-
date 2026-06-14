-- ============================================================
-- 学生服特有マスタの追加
--   ① 商品の体型区分(Y体/A体/B体)        … products.body_types
--   ② 新品加工オプションマスタ            … processing_options
--   ③ 学年色マスタ(既存 school_grades)の標準シード補助関数
--
--   方針: 「手入力ばかりにならない」よう、
--         - 体型区分は全国共通規格を定数チェックボックスで選ぶ
--         - 加工オプションは applies_to_category でカテゴリ連動(商品ごとの紐付け不要)
--         - 既定の加工オプション/学年は店舗ごとに自動シード(冪等)
--
--   既存規約: store_id text / sort_order / is_active / timestamps /
--             RLS 全許可ポリシー / anon・authenticated へ GRANT
-- ============================================================

-- updated_at 自動更新関数(無ければ作成)
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ── ① 商品: 体型区分 ────────────────────────────────────────
-- 学生服のサイズは「号数 × 体型(Y=やせ型 / A=標準 / B=がっちり)」で表す。
-- 対応体型を配列で保持(空=体型区分なし)。採寸時に選択肢として提示する。
ALTER TABLE products ADD COLUMN IF NOT EXISTS body_types text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN products.body_types IS '対応体型(Y/A/B)。空=体型区分なし';

-- ── ② 新品加工オプションマスタ ──────────────────────────────
-- ネーム刺繍 / 裾上げ / 校章付け 等。お直し(repair_*)とは別概念=新品購入時の加工。
-- applies_to_category が空なら全商品、値ありなら該当カテゴリの商品にのみ自動提示。
CREATE TABLE IF NOT EXISTS processing_options (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            text NOT NULL,
  name                text NOT NULL,                 -- ネーム刺繍 / 裾上げ / 校章付け
  input_type          text NOT NULL DEFAULT 'toggle',-- toggle(有無)/text(文字)/length(寸法)/select(選択)
  unit                text,                          -- 例: cm
  default_price       integer,                       -- 標準加工料金(税込)
  required            boolean NOT NULL DEFAULT false, -- 標準で付帯(必須加工)
  applies_to_category text[] NOT NULL DEFAULT '{}',  -- 連動カテゴリ(空=全商品)
  choices             text[] NOT NULL DEFAULT '{}',  -- input_type=select の選択肢
  notes               text,
  sort_order          integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_processing_options_store ON processing_options(store_id);
COMMENT ON TABLE processing_options IS '新品加工オプションマスタ(刺繍・裾上げ・校章等。カテゴリ連動で自動提示)';

-- ── updated_at トリガ & RLS(既存規約: anon/authenticated 全許可) ─
DROP TRIGGER IF EXISTS trg_processing_options_updated_at ON public.processing_options;
CREATE TRIGGER trg_processing_options_updated_at
  BEFORE UPDATE ON public.processing_options
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
ALTER TABLE public.processing_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "processing_options_all" ON public.processing_options;
CREATE POLICY "processing_options_all" ON public.processing_options
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON processing_options TO anon, authenticated;

-- ── 既定の加工オプションを店舗ごとに自動シード(冪等) ─────────
-- 既に加工オプションがある店舗はスキップ。学校を持つ店舗を対象。
DO $$
DECLARE v_store text;
BEGIN
  FOR v_store IN SELECT DISTINCT store_id::text FROM schools LOOP
    IF EXISTS (SELECT 1 FROM processing_options WHERE store_id = v_store) THEN
      CONTINUE;
    END IF;
    INSERT INTO processing_options
      (store_id, name, input_type, unit, default_price, required, applies_to_category, sort_order)
    VALUES
      (v_store, '裾上げ',       'length', 'cm', 0,   true,  ARRAY['スラックス・スカート'],        1),
      (v_store, 'ネーム刺繍',   'text',   NULL, 500, false, ARRAY['制服（上着）','体操着'],        2),
      (v_store, '校章付け',     'toggle', NULL, 0,   true,  ARRAY['制服（上着）'],                3),
      (v_store, 'ボタン付け替え','toggle', NULL, 0,   false, ARRAY['制服（上着）'],                4),
      (v_store, '袖丈調整',     'length', 'cm', 0,   false, ARRAY['制服（上着）'],                5);
  END LOOP;
END $$;

-- ── ③ 学年色: 標準学年シード関数 ────────────────────────────
-- UI の「標準学年を生成」ボタンから呼ぶ。指定学校に 1〜n 年 + 既定色を投入。
-- 既に学年がある学校はスキップ(冪等)。grade_count は中学/高校とも 3 が標準。
CREATE OR REPLACE FUNCTION seed_default_grades(p_school_id uuid, p_grade_count integer DEFAULT 3)
RETURNS void AS $$
DECLARE
  i integer;
  colors text[][] := ARRAY[
    ['赤',     '#DC2626'],
    ['青',     '#2563EB'],
    ['緑',     '#16A34A'],
    ['黄',     '#CA8A04'],
    ['紫',     '#7C3AED'],
    ['橙',     '#EA580C']
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM school_grades WHERE school_id = p_school_id) THEN
    RETURN;
  END IF;
  FOR i IN 1..GREATEST(p_grade_count, 1) LOOP
    INSERT INTO school_grades (school_id, grade_name, color_name, color_hex, sort_order, updated_by)
    VALUES (
      p_school_id,
      i || '年',
      colors[((i - 1) % 6) + 1][1],
      colors[((i - 1) % 6) + 1][2],
      i - 1,
      'system'
    );
  END LOOP;
END; $$ LANGUAGE plpgsql;

-- PostgREST スキーマキャッシュを再読込
NOTIFY pgrst, 'reload schema';
