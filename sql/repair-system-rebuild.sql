-- ============================================================================
--  お直し受付システム — ゼロから再構築（マスタ + 取引 + 写真）
--  2026-06-14  Claude Code
--
--  ■ 構成（シンプル6→実質「マスタ3表 + 取引1表 + 写真1表」）
--    マスタ : repair_garment_types(服種) > repair_items(項目=基本料金) > repair_options(オプション=価格差分)
--    取引   : repair_histories（1お直し=1行。複数項目は slip_number で束ねる）
--    写真   : repair_photos（受付前/完成/再加工/お渡し）
--
--  ■ 設計判断
--    当初案の repair_orders/repair_order_lines（ヘッダ+明細の正規化）は、
--    既存アプリ（CRM/配送/受付/通知/統計）が repair_histories フラット構造前提のため過剰。
--    「1お直し=1行」に統一し、マスタ連携・価格モード・オプション/採寸を JSONB で拡張。
--    option_groups / manuals は repair_options.group_* / *.manual(JSONB) に内包。
--
--  ■ 破壊的: ローンチ前のため既存お直しデータは全削除して作り直す。
-- ============================================================================

BEGIN;

-- ── 0. 旧テーブル破棄 ────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.repair_histories       CASCADE;
DROP TABLE IF EXISTS public.repair_price_presets   CASCADE;
DROP TABLE IF EXISTS public.repair_item_categories CASCADE;
DROP TABLE IF EXISTS public.repair_photos          CASCADE;
DROP TABLE IF EXISTS public.repair_options         CASCADE;
DROP TABLE IF EXISTS public.repair_items           CASCADE;
DROP TABLE IF EXISTS public.repair_garment_types   CASCADE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================================
--  マスタ
-- ============================================================================
CREATE TABLE public.repair_garment_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code        text        NOT NULL,
  name        text        NOT NULL,
  icon        text,
  sort_order  integer     NOT NULL DEFAULT 100,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE TABLE public.repair_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  garment_type_id uuid        NOT NULL REFERENCES public.repair_garment_types(id) ON DELETE CASCADE,
  code            text        NOT NULL,
  name            text        NOT NULL,
  icon            text,
  base_price      integer     NOT NULL DEFAULT 0,             -- 基本料金（税込運用）
  price_unit      text        NOT NULL DEFAULT 'per_item'
                              CHECK (price_unit IN ('per_item','per_pair','per_cm','per_name')),
  measurements    jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- [{key,label,unit,required}]
  manual          jsonb,                                      -- {title,body,severity,images:[{path,caption}]}
  lead_time_days  integer,
  requires_quote  boolean     NOT NULL DEFAULT false,
  sort_order      integer     NOT NULL DEFAULT 100,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_items_garment ON public.repair_items(garment_type_id);
CREATE INDEX idx_repair_items_store   ON public.repair_items(store_id, active);

CREATE TABLE public.repair_options (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id       uuid        NOT NULL REFERENCES public.repair_items(id) ON DELETE CASCADE,
  group_label   text,                                         -- 同ラベルでUIまとめ表示（null=単独）
  group_select  text        NOT NULL DEFAULT 'multi'
                            CHECK (group_select IN ('single','multi')),
  code          text        NOT NULL,
  name          text        NOT NULL,
  price_delta   integer     NOT NULL DEFAULT 0,               -- ＋加算（マイナス=減額も可）
  price_unit    text        NOT NULL DEFAULT 'per_item'
                            CHECK (price_unit IN ('per_item','per_pair','per_cm','per_name')),
  default_selected boolean  NOT NULL DEFAULT false,
  requires_quote   boolean  NOT NULL DEFAULT false,
  manual        jsonb,
  sort_order    integer     NOT NULL DEFAULT 100,
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_options_item ON public.repair_options(item_id, active);

-- ============================================================================
--  取引: お直し（1お直し=1行。複数項目は slip_number で束ねる）
-- ============================================================================
CREATE TABLE public.repair_histories (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id             uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  child_id                uuid        REFERENCES public.children(id) ON DELETE SET NULL,
  slip_number             text,
  item_name               text        NOT NULL,
  content                 text        NOT NULL DEFAULT '',    -- お直し内容（自動生成 or 自由入力）
  status                  text        NOT NULL DEFAULT 'received'
                                      CHECK (status IN ('received','completed','delivered')),
  received_date           date        NOT NULL DEFAULT CURRENT_DATE,
  completed_date          date,
  delivered_date          date,
  price                   integer,                            -- 請求額（= final_price と同期）
  notes                   text,
  notified                boolean     NOT NULL DEFAULT false,
  -- 運用フィールド（既存互換）
  request_type            text        DEFAULT 'repair',
  prepaid                 boolean     NOT NULL DEFAULT false,
  desired_completion_date date,
  work_started            boolean     NOT NULL DEFAULT false,
  request_no              integer,
  -- お直し詳細（既存互換: 採寸の代表値・刺繍・外注・再加工）
  repair_type             text,
  hem_length_mm           smallint,
  sleeve_adjust_mm        smallint,
  waist_adjust_mm         smallint,
  embroidery_text         text,
  embroidery_color        text,
  embroidery_pos          text,
  vendor_name             text,
  sent_to_vendor_at       date,
  expected_return_date    date,
  is_rework               boolean     DEFAULT false,
  rework_reason           text,
  internal_memo           text,
  -- ▼ 新マスタ連携・価格モード・拡張（再構築の中核）
  garment_type_id         uuid        REFERENCES public.repair_garment_types(id) ON DELETE SET NULL,
  item_id                 uuid        REFERENCES public.repair_items(id) ON DELETE SET NULL,
  item_code               text,
  garment_name            text,                               -- 服種名スナップショット
  base_price              integer,                            -- 受付時の基本料金スナップショット
  calculated_price        integer,                            -- マスタ計算の理論値
  final_price             integer,                            -- 確定額（null=見積もり待ち）
  pricing_mode            text        NOT NULL DEFAULT 'master'
                                      CHECK (pricing_mode IN ('master','adjusted','manual')),
  quote_status            text        NOT NULL DEFAULT 'fixed'
                                      CHECK (quote_status IN ('fixed','pending','approved')),
  manual_reason           text,                               -- adjusted/manual の理由
  selected_options        jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- 選択オプションのスナップショット
  inputs                  jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- 採寸など入力値
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_store_id    ON public.repair_histories(store_id);
CREATE INDEX idx_repair_customer_id ON public.repair_histories(customer_id);
CREATE INDEX idx_repair_status      ON public.repair_histories(store_id, status);
CREATE INDEX idx_repair_received    ON public.repair_histories(store_id, received_date DESC);
CREATE INDEX idx_repair_quote       ON public.repair_histories(store_id, quote_status);

CREATE TRIGGER set_repair_histories_updated_at
  BEFORE UPDATE ON public.repair_histories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 店舗ごとの依頼番号 自動採番
CREATE OR REPLACE FUNCTION public.assign_repair_request_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.request_no IS NULL THEN
    SELECT COALESCE(MAX(request_no), 0) + 1 INTO NEW.request_no
    FROM public.repair_histories WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_repair_request_no ON public.repair_histories;
CREATE TRIGGER trg_repair_request_no
  BEFORE INSERT ON public.repair_histories
  FOR EACH ROW EXECUTE FUNCTION public.assign_repair_request_no();

-- ============================================================================
--  取引: 実績写真
-- ============================================================================
CREATE TABLE public.repair_photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  repair_id   uuid        NOT NULL REFERENCES public.repair_histories(id) ON DELETE CASCADE,
  phase       text        NOT NULL DEFAULT 'intake'
                          CHECK (phase IN ('intake','before','after','rework','delivery')),
  path        text        NOT NULL,
  url         text,
  note        text,
  taken_by    uuid        REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_photos_repair ON public.repair_photos(repair_id);

-- ============================================================================
--  RLS（既存方針: anon 全許可。旧マスタの RLS無効穴も解消）
-- ============================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'repair_garment_types','repair_items','repair_options','repair_histories','repair_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon all %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "anon all %1$s" ON public.%1$s FOR ALL TO anon          USING (true) WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth all %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "auth all %1$s" ON public.%1$s FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;

-- 写真ストレージ用バケット（公開・シンプル運用。機密性が要れば private へ）
INSERT INTO storage.buckets (id, name, public)
VALUES ('repair-photos', 'repair-photos', true)
ON CONFLICT (id) DO NOTHING;

COMMIT;
