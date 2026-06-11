-- ============================================================
-- かんたんLINEモード + 置くだけスキャン
--   1. staff_line_accounts : スタッフのLINEアカウント登録
--   2. stores.staff_link_code : スタッフ登録用の合言葉コード
--   3. kantan_tasks : 日次タスク（LINE返信で完了させる）
--   4. scan_inbox : 置くだけスキャンの読取結果ドラフト
-- ============================================================

-- ── 1. スタッフLINEアカウント ────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_line_accounts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  line_user_id  text        NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_line_store ON staff_line_accounts(store_id);

-- ── 2. スタッフ登録コード（6桁） ─────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS staff_link_code text;

-- ── 3. かんたんタスク ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kantan_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  task_date   date        NOT NULL DEFAULT CURRENT_DATE,
  seq         int         NOT NULL,
  task_type   text        NOT NULL CHECK (task_type IN ('repair_finish', 'repair_deliver', 'purchase_notify')),
  ref_id      uuid        NOT NULL,
  label       text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  done_by     text,
  done_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, task_date, seq)
);

CREATE INDEX IF NOT EXISTS idx_kantan_tasks_store_date ON kantan_tasks(store_id, task_date);

-- ── 4. 置くだけスキャン受信箱 ────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_inbox (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slip_type       text        NOT NULL CHECK (slip_type IN ('repair', 'order', 'inquiry')),
  extracted       jsonb       NOT NULL DEFAULT '{}',
  confidence      text,
  warnings        jsonb       NOT NULL DEFAULT '[]',
  image_data      text,       -- 縮小JPEGのdata URL（確認用）
  status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'discarded')),
  promoted_table  text,
  promoted_id     uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_inbox_store ON scan_inbox(store_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION update_scan_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scan_inbox_updated_at ON scan_inbox;
CREATE TRIGGER trg_scan_inbox_updated_at
  BEFORE UPDATE ON scan_inbox FOR EACH ROW
  EXECUTE FUNCTION update_scan_inbox_updated_at();

-- ── RLS（既存テーブルと同方針） ──────────────────────────────
ALTER TABLE staff_line_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kantan_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_inbox          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_line_all_anon"  ON staff_line_accounts;
DROP POLICY IF EXISTS "staff_line_all_auth"  ON staff_line_accounts;
CREATE POLICY "staff_line_all_anon" ON staff_line_accounts FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "staff_line_all_auth" ON staff_line_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kantan_tasks_all_anon" ON kantan_tasks;
DROP POLICY IF EXISTS "kantan_tasks_all_auth" ON kantan_tasks;
CREATE POLICY "kantan_tasks_all_anon" ON kantan_tasks FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "kantan_tasks_all_auth" ON kantan_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scan_inbox_all_anon" ON scan_inbox;
DROP POLICY IF EXISTS "scan_inbox_all_auth" ON scan_inbox;
CREATE POLICY "scan_inbox_all_anon" ON scan_inbox FOR ALL TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "scan_inbox_all_auth" ON scan_inbox FOR ALL TO authenticated USING (true) WITH CHECK (true);
