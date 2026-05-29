-- ============================================================
-- Kitchen Scheduler Migration
-- 調理スケジューラー用テーブル・カラム追加
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ① menus テーブルに調理スケジューリング用カラムを追加
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS cook_minutes   integer,          -- 基本調理時間（分）。NULL = スケジューリング対象外
  ADD COLUMN IF NOT EXISTS station_type   text,             -- 調理ステーションタイプ（例: 'grill','fryer','drink'）
  ADD COLUMN IF NOT EXISTS finish_minutes integer;          -- バッファ（作り置き）がある場合の仕上げ時間（分）

COMMENT ON COLUMN menus.cook_minutes   IS '通常の調理に要する時間（分）。NULLの場合はスケジューリング対象外';
COMMENT ON COLUMN menus.station_type   IS 'kitchen_stations.station_type と紐づく識別子';
COMMENT ON COLUMN menus.finish_minutes IS '作り置き在庫がある場合の仕上げのみの時間（分）。NULLの場合はcook_minutesの30%で算出';

-- ② takeout_order_items に is_done カラムを追加（未追加の場合）
ALTER TABLE takeout_order_items
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

-- ③ takeout_orders に pickup_time / order_source を追加（未追加の場合）
ALTER TABLE takeout_orders
  ADD COLUMN IF NOT EXISTS pickup_time  timestamptz,
  ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'walkin'
    CHECK (order_source IN ('line','phone','walkin','app'));

-- ④ kitchen_stations テーブルを作成
CREATE TABLE IF NOT EXISTS kitchen_stations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         text        NOT NULL,                        -- 機材名（例: 「メイン焼き台」「フライヤーA」）
  station_type text        NOT NULL,                        -- menus.station_type と対応する識別子
  capacity     integer     NOT NULL DEFAULT 10              -- 同時調理可能数（同時に扱えるアイテム数）
                           CHECK (capacity > 0),
  is_active    boolean     NOT NULL DEFAULT true,           -- false にするとスロット計算から除外
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  kitchen_stations          IS '調理機材・ステーション管理。is_active=falseで故障・休止を表現';
COMMENT ON COLUMN kitchen_stations.capacity IS '同時に調理できるアイテム数の上限（例: 焼き台30=同時30串）';

-- ⑤ RLS
ALTER TABLE kitchen_stations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kitchen_stations_anon_all" ON kitchen_stations;
CREATE POLICY "kitchen_stations_anon_all"
  ON kitchen_stations FOR ALL TO anon USING (true) WITH CHECK (true);

-- ⑥ インデックス
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_store
  ON kitchen_stations(store_id, station_type, is_active);

CREATE INDEX IF NOT EXISTS idx_menus_station_type
  ON menus(store_id, station_type)
  WHERE station_type IS NOT NULL;

-- ============================================================
-- サンプルデータ（動作確認用。本番では削除してください）
-- ※ store_id は実際の値に置き換えてください
-- ============================================================
-- INSERT INTO kitchen_stations (store_id, name, station_type, capacity) VALUES
--   ('YOUR_STORE_ID', 'メイン焼き台',   'grill',  30),
--   ('YOUR_STORE_ID', 'フライヤーA',    'fryer',  20),
--   ('YOUR_STORE_ID', 'フライヤーB',    'fryer',  20),
--   ('YOUR_STORE_ID', 'ドリンクコーナー', 'drink', 50);
