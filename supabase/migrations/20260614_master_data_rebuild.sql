-- ============================================================
-- マスタデータ再構築 (5マスタ正規化 + 互換ビュー + シード)
--   設計: docs/master-data-redesign.md / prisma/schema.prisma
--
--   新・正規化テーブル(唯一の真実):
--     size_sets / size_set_items   … サイズセットマスタ(メーカー規格)
--     products                     … 商品マスタ(自由商品=school_id null / 学校別注品)
--     school_requirements          … 学校別規程(School×Product)
--     prices                       … 価格(School×Product×サイズ・別寸EO)
--   据え置き: schools / school_grades / suppliers
--
--   互換ビュー(既存の採寸/EC/受付/お直し等が無改修で動くため):
--     school_products / school_product_variants / school_items
--
-- ※ 既存マスタはテストデータのため DROP して作り直す。
-- ※ Supabase SQL Editor で上から実行してください。
-- ============================================================

-- updated_at 自動更新関数(無ければ作成)
CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ── 旧マスタ(テストデータ)を破棄 ────────────────────────────
-- テーブル/ビューのどちらでも安全に削除(再実行対応)
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY[
    'school_product_variants','school_products','school_items',
    'prices','school_requirements','size_set_items','size_sets','products'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = n AND c.relkind = 'v'
    ) THEN
      EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', n);
    ELSE
      EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', n);
    END IF;
  END LOOP;
END $$;

-- store_id は既存マスタに合わせ text 型で統一(suppliers 等が text のため)。
-- schools.id は uuid なので school 系参照は uuid を使う。

-- ── 3. サイズセットマスタ ───────────────────────────────────
CREATE TABLE size_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text NOT NULL,
  supplier_id uuid,
  name        text NOT NULL,                -- 例: トンボ ブレザーA体
  category    text,                         -- tops/bottoms/shoes/general
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_size_sets_store ON size_sets(store_id);

CREATE TABLE size_set_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_set_id uuid NOT NULL REFERENCES size_sets(id) ON DELETE CASCADE,
  label       text NOT NULL,               -- 例: 160 / M / W64 / 170B
  sort_order  integer NOT NULL DEFAULT 0,
  UNIQUE (size_set_id, label)
);
CREATE INDEX idx_size_set_items_set ON size_set_items(size_set_id);

-- ── 2. 商品マスタ(自由商品 / 学校別注品) ────────────────────
CREATE TABLE products (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           text NOT NULL,
  school_id          uuid REFERENCES schools(id) ON DELETE CASCADE, -- null=自由商品(全校共通)
  name               text NOT NULL,
  category           text,
  gender             text,                  -- 男子用/女子用/男女共通
  supplier_id        uuid,                  -- メーカー(suppliers.id)
  maker              text,                  -- メーカー名(表示用キャッシュ)
  maker_code         text,                  -- メーカー品番(重複可)
  color_code         text,
  barcode            text,
  washable           text,                  -- washable/hand/dry/none 等
  size_set_id        uuid REFERENCES size_sets(id) ON DELETE SET NULL,
  base_price_tax_in  integer,               -- 標準価格(学校別上書きが無い場合)
  base_price_tax_out integer,
  notes              text,
  active             boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_store        ON products(store_id);
CREATE INDEX idx_products_store_school ON products(store_id, school_id);

-- ── 4. 学校別規程マスタ(School×Product 割当 + ルール) ───────
CREATE TABLE school_requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         text NOT NULL,
  school_id        uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  required         boolean NOT NULL DEFAULT true,    -- 必須品か(false=任意)
  avg_qty          numeric(4,1),                     -- 平均購入点数
  uses_grade_color boolean NOT NULL DEFAULT false,   -- 学年で色が変わる
  grade_color_note text NOT NULL DEFAULT '',
  item_notes       text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, product_id)
);
CREATE INDEX idx_school_req_lookup ON school_requirements(school_id, required, sort_order);

-- 学校別注品(products.school_id IS NOT NULL)は所属校以外に割当不可
CREATE OR REPLACE FUNCTION check_requirement_school() RETURNS trigger AS $$
DECLARE owner uuid;
BEGIN
  SELECT school_id INTO owner FROM products WHERE id = NEW.product_id;
  IF owner IS NOT NULL AND owner <> NEW.school_id THEN
    RAISE EXCEPTION '学校別注品(%) は所属校以外に割り当てられません', NEW.product_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_check_requirement_school
  BEFORE INSERT OR UPDATE ON school_requirements
  FOR EACH ROW EXECUTE FUNCTION check_requirement_school();

-- ── 5. 価格マスタ(School×Product×サイズ・別寸) ─────────────
CREATE TABLE prices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          text NOT NULL,
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_set_item_id  uuid REFERENCES size_set_items(id) ON DELETE CASCADE, -- null=全サイズ共通
  size_label        text,                  -- 表示用サイズ(互換ビュー/自由入力サイズ向け)
  price_tax_in      integer NOT NULL,
  price_tax_out     integer,
  cost              integer,
  is_eo             boolean NOT NULL DEFAULT false, -- 別寸(EO)価格
  valid_from        date,
  active            boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
-- 学校×商品×サイズ×別寸 で一意(サイズ未指定は固定UUIDで代替)
CREATE UNIQUE INDEX uq_prices_scope ON prices(
  school_id, product_id,
  COALESCE(size_set_item_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(size_label, ''),
  is_eo
);
CREATE INDEX idx_prices_lookup ON prices(school_id, product_id);

-- ── updated_at トリガ & RLS(既存規約: anon/authenticated 全許可) ─
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['size_sets','products','school_requirements','prices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION handle_updated_at();', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- ============================================================
-- 互換ビュー: 既存機能(採寸/EC/受付/お直し/待合)を無改修で動かす
--   - school_products       : 1規程=1行。id=requirement.id, school_id付き
--   - school_product_variants: product_id=requirement.id でサイズ・価格を展開
--   - school_items          : 待合/採寸パネルの GET 用
-- ============================================================
CREATE VIEW school_products AS
SELECT
  sr.id              AS id,            -- ※ 採寸/EC はこの id で variants を引く
  p.store_id         AS store_id,
  sr.school_id       AS school_id,
  p.name             AS item_name,
  p.maker            AS maker,
  p.maker_code       AS maker_code,
  p.color_code       AS color_code,
  p.category         AS category,
  p.gender           AS gender,
  p.notes            AS notes,
  p.barcode          AS barcode,
  sr.sort_order      AS sort_order,
  p.active           AS active,
  sr.required        AS required,
  sr.avg_qty         AS avg_qty,
  sr.uses_grade_color AS uses_grade_color,
  sr.grade_color_note AS grade_color_note,
  eo.price_tax_in    AS eo_price_tax_in,
  eo.price_tax_out   AS eo_price_tax_out,
  p.id               AS product_master_id,  -- 元商品ID(新UI用)
  sr.id              AS requirement_id,
  p.created_at       AS created_at,
  p.updated_at       AS updated_at
FROM school_requirements sr
JOIN products p ON p.id = sr.product_id
LEFT JOIN LATERAL (
  SELECT price_tax_in, price_tax_out FROM prices
  WHERE school_id = sr.school_id AND product_id = sr.product_id AND is_eo = true
  ORDER BY sort_order LIMIT 1
) eo ON true;

CREATE VIEW school_product_variants AS
SELECT
  pr.id          AS id,
  sr.id          AS product_id,         -- school_products.id と一致させる
  pr.store_id    AS store_id,
  COALESCE(ssi.label, pr.size_label, '') AS size_label,
  pr.price_tax_in AS price,
  pr.cost        AS cost,
  0              AS stock,
  pr.active      AS active,
  pr.sort_order  AS sort_order,
  pr.created_at  AS created_at,
  pr.updated_at  AS updated_at
FROM prices pr
JOIN school_requirements sr
  ON sr.school_id = pr.school_id AND sr.product_id = pr.product_id
LEFT JOIN size_set_items ssi ON ssi.id = pr.size_set_item_id
WHERE pr.is_eo = false;

CREATE VIEW school_items AS
SELECT
  sr.id               AS id,
  sr.school_id        AS school_id,
  p.name              AS name,
  sr.required         AS required,
  COALESCE(base.price_tax_in,  p.base_price_tax_in)  AS price_tax_in,
  COALESCE(base.price_tax_out, p.base_price_tax_out) AS price_tax_out,
  eo.price_tax_in     AS eo_price_tax_in,
  eo.price_tax_out    AS eo_price_tax_out,
  base.cost           AS cost_price,
  COALESCE(ss.name, '') AS size_spec,
  COALESCE(p.maker_code, '') AS product_code,
  false               AS growth_adjust,
  COALESCE(p.washable, '') AS washable,
  sr.avg_qty          AS avg_qty,
  sr.uses_grade_color AS uses_grade_color,
  sr.grade_color_note AS grade_color_note,
  sr.item_notes       AS item_notes,
  sr.sort_order       AS sort_order,
  sr.created_at       AS created_at,
  sr.updated_at       AS updated_at,
  ''                  AS updated_by
FROM school_requirements sr
JOIN products p ON p.id = sr.product_id
LEFT JOIN size_sets ss ON ss.id = p.size_set_id
LEFT JOIN LATERAL (
  SELECT price_tax_in, price_tax_out, cost FROM prices
  WHERE school_id = sr.school_id AND product_id = sr.product_id AND is_eo = false AND size_set_item_id IS NULL
  ORDER BY sort_order LIMIT 1
) base ON true
LEFT JOIN LATERAL (
  SELECT price_tax_in, price_tax_out FROM prices
  WHERE school_id = sr.school_id AND product_id = sr.product_id AND is_eo = true
  ORDER BY sort_order LIMIT 1
) eo ON true;

-- ============================================================
-- シードデータ(学校が登録済みの店舗に対してサンプル投入)
--   既にサンプルがある場合はスキップ(冪等)
-- ============================================================
DO $$
DECLARE
  v_store   text;
  v_school  record;
  v_ss_top  uuid;  -- サイズセット: 上衣
  v_ss_btm  uuid;  -- サイズセット: 下衣
  v_ss_shoe uuid;  -- サイズセット: 上靴
  v_blazer  uuid;
  v_slacks  uuid;
  v_shirt   uuid;  -- 自由商品(全校共通)
  v_shoes   uuid;  -- 自由商品(全校共通)
  v_req     uuid;
  v_item    record;
  i integer;
BEGIN
  -- 店舗ごとにループ(schools を持つ store_id を対象)
  FOR v_store IN SELECT DISTINCT store_id::text FROM schools LOOP
    -- 既にこの店舗にサイズセットがあればスキップ
    IF EXISTS (SELECT 1 FROM size_sets WHERE store_id = v_store) THEN
      CONTINUE;
    END IF;

    -- サイズセット作成
    INSERT INTO size_sets(store_id, name, category, sort_order)
      VALUES (v_store, '標準 上衣サイズ', 'tops', 1) RETURNING id INTO v_ss_top;
    INSERT INTO size_sets(store_id, name, category, sort_order)
      VALUES (v_store, '標準 下衣サイズ', 'bottoms', 2) RETURNING id INTO v_ss_btm;
    INSERT INTO size_sets(store_id, name, category, sort_order)
      VALUES (v_store, '上靴サイズ', 'shoes', 3) RETURNING id INTO v_ss_shoe;

    -- 上衣サイズ項目
    FOR i IN 1..8 LOOP
      INSERT INTO size_set_items(size_set_id, label, sort_order)
        VALUES (v_ss_top, (140 + i*5)::text, i);   -- 145..180
    END LOOP;
    -- 下衣サイズ項目(ウエスト)
    FOR i IN 1..7 LOOP
      INSERT INTO size_set_items(size_set_id, label, sort_order)
        VALUES (v_ss_btm, ('W' || (60 + i*2))::text, i); -- W62..W74
    END LOOP;
    -- 上靴サイズ項目
    FOR i IN 1..10 LOOP
      INSERT INTO size_set_items(size_set_id, label, sort_order)
        VALUES (v_ss_shoe, (21 + i*0.5)::text, i);  -- 21.5..26.0
    END LOOP;

    -- 自由商品(全校共通): ワイシャツ / 上靴
    INSERT INTO products(store_id, school_id, name, category, gender, maker, size_set_id, base_price_tax_in, sort_order)
      VALUES (v_store, NULL, 'ワイシャツ(男女共通)', 'シャツ・ブラウス', '男女共通', '汎用', v_ss_top, 2200, 10)
      RETURNING id INTO v_shirt;
    INSERT INTO products(store_id, school_id, name, category, gender, maker, size_set_id, base_price_tax_in, sort_order)
      VALUES (v_store, NULL, '上靴', '上靴', '男女共通', '汎用', v_ss_shoe, 1800, 11)
      RETURNING id INTO v_shoes;

    -- 学校ごとに 学校別注品(ブレザー/スラックス) + 規程 + 価格
    FOR v_school IN SELECT id, name FROM schools WHERE store_id::text = v_store LOOP
      -- 学校別注品: ブレザー
      INSERT INTO products(store_id, school_id, name, category, gender, maker, maker_code, size_set_id, base_price_tax_in, sort_order)
        VALUES (v_store, v_school.id, 'ブレザー', '制服（上着）', '男女共通', 'トンボ', 'BL-101', v_ss_top, 14500, 1)
        RETURNING id INTO v_blazer;
      -- 学校別注品: スラックス
      INSERT INTO products(store_id, school_id, name, category, gender, maker, maker_code, size_set_id, base_price_tax_in, sort_order)
        VALUES (v_store, v_school.id, 'スラックス', 'スラックス・スカート', '男子用', 'トンボ', 'SL-101', v_ss_btm, 9800, 2)
        RETURNING id INTO v_slacks;

      -- 規程(必須): ブレザー / スラックス / ワイシャツ(自由商品) / 上靴(自由商品)
      INSERT INTO school_requirements(store_id, school_id, product_id, required, avg_qty, uses_grade_color, sort_order)
        VALUES (v_store, v_school.id, v_blazer, true, 1, false, 1);
      INSERT INTO school_requirements(store_id, school_id, product_id, required, avg_qty, uses_grade_color, sort_order)
        VALUES (v_store, v_school.id, v_slacks, true, 2, false, 2);
      INSERT INTO school_requirements(store_id, school_id, product_id, required, avg_qty, uses_grade_color, sort_order)
        VALUES (v_store, v_school.id, v_shirt, true, 3, false, 3);
      INSERT INTO school_requirements(store_id, school_id, product_id, required, avg_qty, uses_grade_color, sort_order)
        VALUES (v_store, v_school.id, v_shoes, false, 1, false, 4);

      -- 価格(サイズ別): ブレザーは上衣サイズで価格設定、スラックスは下衣サイズ
      FOR v_item IN
        SELECT ssi.id, ssi.label, ssi.sort_order FROM size_set_items ssi WHERE ssi.size_set_id = v_ss_top
      LOOP
        INSERT INTO prices(store_id, school_id, product_id, size_set_item_id, size_label, price_tax_in, sort_order)
          VALUES (v_store, v_school.id, v_blazer, v_item.id, v_item.label, 14500, v_item.sort_order);
        INSERT INTO prices(store_id, school_id, product_id, size_set_item_id, size_label, price_tax_in, sort_order)
          VALUES (v_store, v_school.id, v_shirt, v_item.id, v_item.label, 2200, v_item.sort_order);
      END LOOP;
      FOR v_item IN
        SELECT ssi.id, ssi.label, ssi.sort_order FROM size_set_items ssi WHERE ssi.size_set_id = v_ss_btm
      LOOP
        INSERT INTO prices(store_id, school_id, product_id, size_set_item_id, size_label, price_tax_in, sort_order)
          VALUES (v_store, v_school.id, v_slacks, v_item.id, v_item.label, 9800, v_item.sort_order);
      END LOOP;
      FOR v_item IN
        SELECT ssi.id, ssi.label, ssi.sort_order FROM size_set_items ssi WHERE ssi.size_set_id = v_ss_shoe
      LOOP
        INSERT INTO prices(store_id, school_id, product_id, size_set_item_id, size_label, price_tax_in, sort_order)
          VALUES (v_store, v_school.id, v_shoes, v_item.id, v_item.label, 1800, v_item.sort_order);
      END LOOP;

      -- 別寸(EO)価格: ブレザー +3000
      INSERT INTO prices(store_id, school_id, product_id, size_label, price_tax_in, is_eo, sort_order)
        VALUES (v_store, v_school.id, v_blazer, '別寸', 17500, true, 99);
    END LOOP;
  END LOOP;
END $$;

-- ── PostgREST(anon/authenticated)向け権限付与 ──────────────────
-- 新テーブル・互換ビューを JS クライアント(anon キー)から読めるようにする。
GRANT SELECT, INSERT, UPDATE, DELETE ON
  size_sets, size_set_items, products, school_requirements, prices
  TO anon, authenticated;
GRANT SELECT ON
  school_products, school_product_variants, school_items
  TO anon, authenticated;

-- PostgREST スキーマキャッシュを再読込
NOTIFY pgrst, 'reload schema';
