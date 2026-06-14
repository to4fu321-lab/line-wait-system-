-- ============================================================================
--  お直し受付システム — ゼロから再構築（マスタ + 取引 + 写真）
--  2026-06-14  Claude Code
--
--  ■ 方針
--    服種(garment) > 項目(item) > オプション(option) の3階層マスタ。
--    基本料金は「項目」、加算/減算は「オプション」が持つ。
--    受付はヘッダ(orders) + 明細(lines) + 実績写真(photos)。
--    マスタにない特殊対応は line.pricing_mode='manual' で吸収（マスタを汚さない）。
--
--  ■ シンプル化メモ（フル設計からの折りたたみ）
--    - option_groups テーブルは作らず repair_options.group_label / group_select に内包。
--    - manuals テーブルは作らず repair_items.manual / repair_options.manual (JSONB) に内包。
--      → 参考画像を多数の項目で共有したくなったら、これらを独立テーブルへ切り出せる。
--
--  ■ 破壊的: ローンチ前のため既存お直しデータは全削除して作り直す。
-- ============================================================================

BEGIN;

-- ── 0. 旧テーブル破棄 ────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.repair_histories      CASCADE;
DROP TABLE IF EXISTS public.repair_price_presets  CASCADE;
DROP TABLE IF EXISTS public.repair_item_categories CASCADE;

-- 新テーブルも作り直し（再実行可能に）
DROP TABLE IF EXISTS public.repair_photos        CASCADE;
DROP TABLE IF EXISTS public.repair_order_lines   CASCADE;
DROP TABLE IF EXISTS public.repair_orders        CASCADE;
DROP TABLE IF EXISTS public.repair_options       CASCADE;
DROP TABLE IF EXISTS public.repair_items         CASCADE;
DROP TABLE IF EXISTS public.repair_garment_types CASCADE;

-- updated_at 共通トリガー関数（既存 set_updated_at があれば再利用、無ければ作成）
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================================
--  マスタ（価格表 — 滅多に変わらない）
-- ============================================================================

-- ── 1. 服種マスタ ──────────────────────────────────────────────────────
CREATE TABLE public.repair_garment_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code        text        NOT NULL,                 -- jacket / slacks / skirt ... 安定キー
  name        text        NOT NULL,                 -- 表示名: 上着 / スラックス
  icon        text,                                 -- 絵文字
  sort_order  integer     NOT NULL DEFAULT 100,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

-- ── 2. 項目マスタ（= 基本料金） ────────────────────────────────────────
CREATE TABLE public.repair_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  garment_type_id uuid        NOT NULL REFERENCES public.repair_garment_types(id) ON DELETE CASCADE,
  code            text        NOT NULL,             -- hem/sleeve/waist/embroidery/badge/button/tear/other (RepairType互換)
  name            text        NOT NULL,             -- 裾上げ / ウエスト出し
  icon            text,
  base_price      integer     NOT NULL DEFAULT 0,   -- 基本料金（税込で運用。税区分は将来 store 設定で）
  price_unit      text        NOT NULL DEFAULT 'per_item'
                              CHECK (price_unit IN ('per_item','per_pair','per_cm','per_name')),
  measurements    jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{key,label,unit,required}] 受付で聞く数値
  manual          jsonb,                            -- {title,body,severity,images:[{path,caption}]} 特殊ケース注意
  lead_time_days  integer,                          -- 標準納期（営業日）。null=店舗デフォルト
  requires_quote  boolean     NOT NULL DEFAULT false, -- true=金額未定で受付し見積もり待ちにできる
  sort_order      integer     NOT NULL DEFAULT 100,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_items_garment ON public.repair_items(garment_type_id);
CREATE INDEX idx_repair_items_store   ON public.repair_items(store_id, active);

-- ── 3. オプションマスタ（= 価格差分。group は内包） ──────────────────────
CREATE TABLE public.repair_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id       uuid        NOT NULL REFERENCES public.repair_items(id) ON DELETE CASCADE,
  group_label   text,                               -- 同ラベルでUIまとめ表示（null=単独チェック）
  group_select  text        NOT NULL DEFAULT 'multi'
                            CHECK (group_select IN ('single','multi')),  -- single=ラジオ / multi=チェック
  code          text        NOT NULL,
  name          text        NOT NULL,               -- 千鳥がけ / すべり止め / 特殊素材
  price_delta   integer     NOT NULL DEFAULT 0,     -- ＋加算（マイナス=減額・割引も可）
  price_unit    text        NOT NULL DEFAULT 'per_item'
                            CHECK (price_unit IN ('per_item','per_pair','per_cm','per_name')),
  default_selected boolean  NOT NULL DEFAULT false,
  requires_quote   boolean  NOT NULL DEFAULT false, -- 選ぶと自動で見積もりモードへ（特殊素材等）
  manual        jsonb,                              -- このオプション固有の注意画像
  sort_order    integer     NOT NULL DEFAULT 100,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_options_item ON public.repair_options(item_id, active);

-- ============================================================================
--  取引（1件ごとの受付 — どんどん増える）
-- ============================================================================

-- ── 4. 受付伝票ヘッダ ──────────────────────────────────────────────────
CREATE TABLE public.repair_orders (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id        uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  child_id           uuid        REFERENCES public.children(id) ON DELETE SET NULL,
  slip_number        text,                          -- 手書き票との照合用
  status             text        NOT NULL DEFAULT 'received'
                                 CHECK (status IN ('received','in_progress','completed','delivered','cancelled')),
                                 -- received    = 預かり中（未着手）
                                 -- in_progress = 作業中
                                 -- completed   = 完了（LINE通知済み）
                                 -- delivered   = お渡し済み
                                 -- cancelled   = キャンセル
  received_date      date        NOT NULL DEFAULT CURRENT_DATE,
  desired_date       date,                          -- 希望仕上がり日
  completed_date     date,
  delivered_date     date,
  total_price        integer     NOT NULL DEFAULT 0,  -- 明細 final_price 合計のキャッシュ
  has_pending_quote  boolean     NOT NULL DEFAULT false, -- 見積もり待ち明細を含むか（着手ガード用）
  payment_status     text        NOT NULL DEFAULT 'unpaid'
                                 CHECK (payment_status IN ('unpaid','prepaid','paid')),
  notified           boolean     NOT NULL DEFAULT false,  -- 完了LINE通知済み
  notes              text,                          -- 顧客向けメモ
  internal_memo      text,                          -- 社内メモ
  vendor_name        text,                          -- 外注先（伝票単位）
  sent_to_vendor_at  timestamptz,
  expected_return_date date,
  is_rework          boolean     NOT NULL DEFAULT false,  -- 再加工
  rework_reason      text,
  created_by         uuid        REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_orders_store    ON public.repair_orders(store_id);
CREATE INDEX idx_repair_orders_customer ON public.repair_orders(customer_id);
CREATE INDEX idx_repair_orders_status   ON public.repair_orders(store_id, status);
CREATE INDEX idx_repair_orders_received ON public.repair_orders(store_id, received_date DESC);

-- ── 5. 受付明細（マスタのスナップショット + 確定金額 + 見積もりモード） ──
CREATE TABLE public.repair_order_lines (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  store_id         uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- マスタ参照（削除されても明細は残す。snapshot がソース・オブ・トゥルース）
  garment_type_id  uuid        REFERENCES public.repair_garment_types(id) ON DELETE SET NULL,
  item_id          uuid        REFERENCES public.repair_items(id) ON DELETE SET NULL,
  -- スナップショット（マスタ改定の影響を受けない）
  garment_name     text,
  item_name        text        NOT NULL,            -- 表示名（manual時は自由入力）
  item_code        text,
  -- 価格モード
  pricing_mode     text        NOT NULL DEFAULT 'master'
                               CHECK (pricing_mode IN ('master','adjusted','manual')),
                               -- master   = マスタ計算値そのまま
                               -- adjusted = マスタ項目だが今回だけ手で上書き
                               -- manual   = マスタに無い特殊対応（自由入力）
  base_price       integer     NOT NULL DEFAULT 0,
  calculated_price integer     NOT NULL DEFAULT 0,  -- マスタ計算の理論値（参考保持）
  final_price      integer,                         -- 確定額（null=見積もり待ち）
  manual_reason    text,                            -- adjusted/manual の理由（必須運用）
  quote_status     text        NOT NULL DEFAULT 'fixed'
                               CHECK (quote_status IN ('fixed','pending','approved')),
                               -- pending  = 見積もり待ち（着手不可）
                               -- approved = 見積もり確定・顧客承認待ち
                               -- fixed    = 確定
  inputs           jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- {hem_length_mm:..,char_count:..,text:..}
  options          jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{option_id,name,price_delta,...}] 選択スナップショット
  qty              integer     NOT NULL DEFAULT 1,
  notes            text,
  sort_order       integer     NOT NULL DEFAULT 100,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_lines_order ON public.repair_order_lines(order_id);
CREATE INDEX idx_repair_lines_quote ON public.repair_order_lines(store_id, quote_status);

-- ── 6. 実績写真（受付前 / 完成 / 再加工 / お渡し） ──────────────────────
CREATE TABLE public.repair_photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id    uuid        NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
  line_id     uuid        REFERENCES public.repair_order_lines(id) ON DELETE SET NULL,
  phase       text        NOT NULL DEFAULT 'intake'
                          CHECK (phase IN ('intake','before','after','rework','delivery')),
  path        text        NOT NULL,                 -- Supabase Storage パス
  url         text,                                 -- 公開URLキャッシュ（任意）
  note        text,
  taken_by    uuid        REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_photos_order ON public.repair_photos(order_id);

-- ============================================================================
--  トリガー（updated_at 自動更新）
-- ============================================================================
CREATE TRIGGER trg_repair_garment_types_updated BEFORE UPDATE ON public.repair_garment_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_repair_items_updated         BEFORE UPDATE ON public.repair_items         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_repair_options_updated       BEFORE UPDATE ON public.repair_options       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_repair_orders_updated        BEFORE UPDATE ON public.repair_orders        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_repair_order_lines_updated   BEFORE UPDATE ON public.repair_order_lines   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
--  RLS（既存テーブルと同じ「anon 全許可」方針。旧マスタの RLS無効穴も解消）
-- ============================================================================
ALTER TABLE public.repair_garment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_options       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_photos        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repair_garment_types','repair_items','repair_options',
    'repair_orders','repair_order_lines','repair_photos'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon all %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "anon all %1$s" ON public.%1$s FOR ALL TO anon          USING (true) WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth all %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "auth all %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- ============================================================================
--  写真ストレージ用バケット（公開・シンプル運用。顧客写真の機密性が要れば private へ）
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-photos', 'repair-photos', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
