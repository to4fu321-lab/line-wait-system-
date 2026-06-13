-- ============================================================
-- 追加マスタ群: 仕入先 / サイズ / 定型文 / 顧客タグ
-- Supabase SQL Editor もしくは MCP apply_migration で実行
-- 既存マスタ(repair_price_presets 等)と同じ規約:
--   id uuid pk / store_id text / sort_order / is_active / timestamps
-- ============================================================

-- ── メーカー・仕入先マスタ ──────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id       text NOT NULL,
  name           text NOT NULL,          -- 仕入先名/メーカー名
  kana           text,                   -- フリガナ
  tel            text,
  email          text,
  contact_person text,                   -- 担当者
  lead_time_days integer,                -- 標準納期(日)
  order_method   text,                   -- 発注方法 fax/web/phone/email/other
  order_url      text,                   -- 発注サイト/FAX送信先など
  min_lot        integer,                -- 最低発注ロット
  notes          text,
  sort_order     integer DEFAULT 0,
  is_active      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
-- 既にテーブルがある場合の追加カラム（再実行安全）
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS order_method text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS order_url    text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS min_lot      integer;
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);
COMMENT ON TABLE suppliers IS 'メーカー・仕入先マスタ（発注先の名称・連絡先・発注方法・標準納期）';

-- ── サイズマスタ ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS size_presets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    text NOT NULL,
  category    text DEFAULT 'general',    -- tops/bottoms/shoes/general など
  label       text NOT NULL,             -- 表示サイズ 例: 150 / M / W64
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_size_presets_store ON size_presets(store_id);
COMMENT ON TABLE size_presets IS 'サイズマスタ（共通サイズ表記。表記ゆれ防止用）';

-- ── 定型文テンプレートマスタ ────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    text NOT NULL,
  category    text DEFAULT 'general',    -- line_notify/repair_note/general など
  title       text NOT NULL,             -- テンプレ名
  body        text NOT NULL,             -- 本文
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_templates_store ON message_templates(store_id);
COMMENT ON TABLE message_templates IS '定型文テンプレート（LINE通知文・注意事項・備考の定型）';

-- ── 顧客タグマスタ ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_tags (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    text NOT NULL,
  name        text NOT NULL,             -- タグ名 例: VIP / 兄弟あり / 卒業予定
  color       text DEFAULT '#6366F1',    -- 表示色(HEX)
  description text,
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_tags_store ON customer_tags(store_id);
COMMENT ON TABLE customer_tags IS '顧客タグマスタ（CRMのセグメント/絞り込み用）';

-- ── RLS（既存テーブルと同様に anon/authenticated を許可） ────
-- アプリはクライアントから anon キーでアクセスするため、
-- 他テーブルと同じく全許可ポリシーを付与する。
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','size_presets','message_templates','customer_tags']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

