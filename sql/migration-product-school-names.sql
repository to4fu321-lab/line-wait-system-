-- products テーブルを作成（存在しない場合）+ school_names カラムを追加
-- Supabase SQL Editor でそのまま実行できます

-- ① テーブル作成
CREATE TABLE IF NOT EXISTS products (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     text        NOT NULL,
  code         text,
  name         text        NOT NULL,
  category     text,
  maker        text,
  gender       text,
  sizes        text[]      NOT NULL DEFAULT '{}',
  price        integer,
  notes        text,
  is_active    boolean     NOT NULL DEFAULT true,
  school_names text[]      NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

-- ② 既存テーブルへの追加（テーブルが既にある場合はこちらが適用される）
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS school_names text[] NOT NULL DEFAULT '{}';

-- ③ インデックス（学校名での絞り込みを高速化）
CREATE INDEX IF NOT EXISTS idx_products_school_names
  ON products USING gin(school_names);

-- ④ RLS ポリシー（必要に応じて調整してください）
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "products_select_all"
  ON products FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "products_all_authenticated"
  ON products FOR ALL USING (true);
