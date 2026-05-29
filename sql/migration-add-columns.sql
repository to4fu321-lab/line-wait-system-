-- ============================================================
-- マイグレーション: 不足カラムの追加
-- 既存データを消さずに実行できます
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- groups テーブル（会社コード・PIN追加）
ALTER TABLE groups ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS pin  text NOT NULL DEFAULT '0000';

-- stores テーブル
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_open          boolean     NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS wait_thresholds  jsonb       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS notice_threshold integer     NOT NULL DEFAULT 3;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allow_remote     boolean     NOT NULL DEFAULT false;

-- queues テーブル
ALTER TABLE queues ADD COLUMN IF NOT EXISTS child_name  text;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS gender      text NOT NULL DEFAULT 'other';
ALTER TABLE queues ADD COLUMN IF NOT EXISTS details     jsonb;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS is_remote   boolean NOT NULL DEFAULT false;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS checked_in  boolean NOT NULL DEFAULT false;

-- stores の更新を anon ロールに許可（is_open 切り替えに必要）
DO $$ BEGIN
  CREATE POLICY "stores_anon_update" ON stores
    FOR UPDATE TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- queues の INSERT/UPDATE/SELECT を anon ロールに許可
DO $$ BEGIN
  CREATE POLICY "queues_anon_all" ON queues
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
