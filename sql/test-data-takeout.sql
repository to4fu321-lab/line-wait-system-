-- ============================================================
-- テイクアウト注文 テストデータ（5名・色々なメニュー）
-- Supabase ダッシュボード > SQL Editor で実行
-- ============================================================

DO $$
DECLARE
  v_store_id uuid;
  v_o1 uuid; v_o2 uuid; v_o3 uuid; v_o4 uuid; v_o5 uuid;
BEGIN
  -- 店舗ID取得（最初の1件）
  SELECT id INTO v_store_id FROM stores LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION '店舗が見つかりません。stores テーブルを確認してください。';
  END IF;

  -- 既存テストデータを削除
  DELETE FROM takeout_orders
  WHERE store_id = v_store_id
    AND customer_name LIKE 'テスト_%';

  -- ──────────────────────────────────────────
  -- 注文①：受付直後（pending）
  -- ──────────────────────────────────────────
  v_o1 := gen_random_uuid();
  INSERT INTO takeout_orders
    (id, store_id, order_number, customer_name, status, total_amount, notes, created_at, updated_at)
  VALUES
    (v_o1, v_store_id, '#001', 'テスト_田中', 'pending', 1350, NULL,
     now() - interval '2 minutes', now() - interval '2 minutes');

  INSERT INTO takeout_order_items (order_id, name, unit_price, quantity, notes)
  VALUES
    (v_o1, '焼き鳥 もも', 180, 3, NULL),
    (v_o1, '焼き鳥 ねぎま', 180, 2, NULL),
    (v_o1, 'ビール（中）', 450, 1, NULL);

  -- ──────────────────────────────────────────
  -- 注文②：調理中（preparing）8分経過
  -- ──────────────────────────────────────────
  v_o2 := gen_random_uuid();
  INSERT INTO takeout_orders
    (id, store_id, order_number, customer_name, status, total_amount, notes, created_at, updated_at)
  VALUES
    (v_o2, v_store_id, '#002', 'テスト_鈴木', 'preparing', 2100, '辛め希望',
     now() - interval '8 minutes', now() - interval '6 minutes');

  INSERT INTO takeout_order_items (order_id, name, unit_price, quantity, notes)
  VALUES
    (v_o2, '唐揚げ弁当', 780, 1, '辛め'),
    (v_o2, '焼き鳥セット（5本）', 900, 1, NULL),
    (v_o2, 'おにぎり（鮭）', 180, 2, NULL),
    (v_o2, 'お茶', 100, 1, NULL);

  -- ──────────────────────────────────────────
  -- 注文③：完成済み（ready）待ち
  -- ──────────────────────────────────────────
  v_o3 := gen_random_uuid();
  INSERT INTO takeout_orders
    (id, store_id, order_number, customer_name, status, total_amount, notes, created_at, updated_at)
  VALUES
    (v_o3, v_store_id, '#003', 'テスト_佐藤', 'ready', 560, NULL,
     now() - interval '14 minutes', now() - interval '3 minutes');

  INSERT INTO takeout_order_items (order_id, name, unit_price, quantity, notes)
  VALUES
    (v_o3, 'からあげ（6個）', 380, 1, NULL),
    (v_o3, 'コーラ', 180, 1, NULL);

  -- ──────────────────────────────────────────
  -- 注文④：受付直後（pending）大量注文
  -- ──────────────────────────────────────────
  v_o4 := gen_random_uuid();
  INSERT INTO takeout_orders
    (id, store_id, order_number, customer_name, status, total_amount, notes, created_at, updated_at)
  VALUES
    (v_o4, v_store_id, '#004', 'テスト_山田', 'pending', 4200, '袋を2枚ください',
     now() - interval '1 minute', now() - interval '1 minute');

  INSERT INTO takeout_order_items (order_id, name, unit_price, quantity, notes)
  VALUES
    (v_o4, '焼き鳥 もも', 180, 5, NULL),
    (v_o4, '焼き鳥 ねぎま', 180, 5, NULL),
    (v_o4, '焼き鳥 つくね', 200, 4, NULL),
    (v_o4, '唐揚げ弁当', 780, 2, NULL),
    (v_o4, 'ビール（中）', 450, 2, NULL);

  -- ──────────────────────────────────────────
  -- 注文⑤：調理中・もうすぐ時間切れ（preparing・12分経過）
  -- ──────────────────────────────────────────
  v_o5 := gen_random_uuid();
  INSERT INTO takeout_orders
    (id, store_id, order_number, customer_name, status, total_amount, notes, created_at, updated_at)
  VALUES
    (v_o5, v_store_id, '#005', 'テスト_伊藤', 'preparing', 1580, 'アレルギー：そば',
     now() - interval '12 minutes', now() - interval '10 minutes');

  INSERT INTO takeout_order_items (order_id, name, unit_price, quantity, notes)
  VALUES
    (v_o5, '幕の内弁当', 980, 1, 'そばアレルギー注意'),
    (v_o5, '焼き鳥 塩（3本）', 450, 1, NULL),
    (v_o5, 'お茶', 100, 1, NULL);

  RAISE NOTICE '✅ テイクアウトテストデータを5件投入しました（store_id: %）', v_store_id;
END $$;


-- ============================================================
-- リセット（テストデータ削除）
-- ============================================================
-- DELETE FROM takeout_orders
-- WHERE customer_name LIKE 'テスト_%';
