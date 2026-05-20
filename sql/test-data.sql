-- ============================================================
-- テストデータ投入スクリプト（本店）
-- Supabase ダッシュボード > SQL Editor で実行
-- ============================================================

-- ① 本店の store_id を確認（実際のIDで上書きしてください）
-- SELECT id, name FROM stores WHERE name = '本店';

DO $$
DECLARE
  v_store_id uuid;
  v_base     int;
BEGIN
  -- 本店のIDを名前で検索
  SELECT id INTO v_store_id FROM stores WHERE name = '本店' LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION '「本店」が見つかりません。stores テーブルを確認してください。';
  END IF;

  -- 既存テストデータを削除（school_name が「テスト校」のもの）
  DELETE FROM queues WHERE store_id = v_store_id AND school_name = 'テスト校';

  -- 今日の最大整理番号を取得
  SELECT COALESCE(MAX(ticket_number), 0) INTO v_base
  FROM queues
  WHERE store_id = v_store_id
    AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date;

  -- ──────────────────────────────────────────
  -- 通常受付（現地・waiting）8人
  -- ──────────────────────────────────────────
  INSERT INTO queues
    (store_id, ticket_number, status, school_name, customer_name, category, gender, is_remote, checked_in)
  VALUES
    (v_store_id, v_base+1,  'waiting', 'テスト校', '田中 一郎',   'fitting', 'male',   false, true),
    (v_store_id, v_base+2,  'waiting', 'テスト校', '鈴木 花子',   'fitting', 'female', false, true),
    (v_store_id, v_base+3,  'waiting', 'テスト校', '佐藤 次郎',   'pickup',  'male',   false, true),
    (v_store_id, v_base+4,  'waiting', 'テスト校', '山田 三枝',   'fitting', 'female', false, true),
    (v_store_id, v_base+5,  'waiting', 'テスト校', '伊藤 四郎',   'other',   'male',   false, true),
    (v_store_id, v_base+6,  'waiting', 'テスト校', '渡辺 五月',   'fitting', 'female', false, true),
    (v_store_id, v_base+7,  'waiting', 'テスト校', '中村 六助',   'pickup',  'male',   false, true),
    (v_store_id, v_base+8,  'waiting', 'テスト校', '小林 七海',   'fitting', 'female', false, true),

  -- ──────────────────────────────────────────
  -- 遠隔チェックイン済み（呼出可能）1人
  -- ──────────────────────────────────────────
    (v_store_id, v_base+9,  'waiting', 'テスト校', '遠隔 チェック済', 'fitting', 'male',   true,  true),

  -- ──────────────────────────────────────────
  -- 遠隔・未チェックイン（呼出不可）1人
  -- ──────────────────────────────────────────
    (v_store_id, v_base+10, 'waiting', 'テスト校', '遠隔 未着',      'fitting', 'female', true,  false);

  RAISE NOTICE '✅ テストデータを % 件投入しました（store_id: %）', 10, v_store_id;
END $$;


-- ============================================================
-- リセット（テストデータ削除）
-- ============================================================
-- DO $$
-- DECLARE v_store_id uuid;
-- BEGIN
--   SELECT id INTO v_store_id FROM stores WHERE name = '本店' LIMIT 1;
--   DELETE FROM queues WHERE store_id = v_store_id AND school_name = 'テスト校';
--   RAISE NOTICE '🗑️  テストデータを削除しました';
-- END $$;
