-- ============================================================
-- CRM テストデータ: お直し・追加購入・来店依頼（問い合わせ）
-- Supabase SQL Editor で実行してください
-- ============================================================
-- ※ 必要なカラムが未追加の場合も自動で追加します
-- ============================================================

-- ─── 必要カラムの確認・追加 ───────────────────────────────────

ALTER TABLE repair_histories
  ADD COLUMN IF NOT EXISTS request_type           text DEFAULT 'repair',
  ADD COLUMN IF NOT EXISTS prepaid                boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS desired_completion_date date,
  ADD COLUMN IF NOT EXISTS payment_status         text;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS maker          text,
  ADD COLUMN IF NOT EXISTS payment_status text;

-- ─── テストデータ投入 ─────────────────────────────────────────

DO $$
DECLARE
  v_store_id uuid;

  -- 顧客ID
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid();

  -- 子供ID
  ch1 uuid := gen_random_uuid();
  ch2 uuid := gen_random_uuid();
  ch3 uuid := gen_random_uuid();
  ch4 uuid := gen_random_uuid();

BEGIN
  -- 最初の店舗を使用（制服系の店舗を優先）
  SELECT id INTO v_store_id
  FROM stores
  WHERE business_type = 'uniform' OR business_type IS NULL
  ORDER BY created_at
  LIMIT 1;

  IF v_store_id IS NULL THEN
    SELECT id INTO v_store_id FROM stores ORDER BY created_at LIMIT 1;
  END IF;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION '店舗が見つかりません。stores テーブルを確認してください。';
  END IF;

  RAISE NOTICE '対象店舗ID: %', v_store_id;

  -- ──────────────────────────────────────────────────────────
  -- 保護者（顧客）の作成
  -- ──────────────────────────────────────────────────────────
  INSERT INTO customers (id, store_id, name, kana, tel, notes, created_at, updated_at)
  VALUES
    (c1, v_store_id, '田中 美咲', 'タナカ ミサキ', '090-1111-2222', NULL, now(), now()),
    (c2, v_store_id, '山田 花子', 'ヤマダ ハナコ', '090-3333-4444', NULL, now(), now()),
    (c3, v_store_id, '佐藤 良子', 'サトウ ヨシコ', '090-5555-6666', NULL, now(), now()),
    (c4, v_store_id, '鈴木 智子', 'スズキ サトコ', '090-7777-8888', NULL, now(), now()),
    (c5, v_store_id, '伊藤 恵美', 'イトウ エミ',   '090-9999-0000', NULL, now(), now());

  -- ──────────────────────────────────────────────────────────
  -- お子様の作成
  -- ──────────────────────────────────────────────────────────
  INSERT INTO children (id, customer_id, store_id, name, kana, school_name, grade, created_at, updated_at)
  VALUES
    (ch1, c1, v_store_id, '田中 翼',    'タナカ ツバサ',  '○○中学校',   '中学2年', now(), now()),
    (ch2, c2, v_store_id, '山田 さくら', 'ヤマダ サクラ',  '○○高等学校', '高校1年', now(), now()),
    (ch3, c3, v_store_id, '佐藤 大輝',  'サトウ ダイキ',  '○○中学校',   '中学3年', now(), now()),
    (ch4, c4, v_store_id, '鈴木 陽菜',  'スズキ ハルナ',  '○○高等学校', '高校2年', now(), now());

  -- ──────────────────────────────────────────────────────────
  -- お直し依頼 (repair_histories) — 8件
  -- ──────────────────────────────────────────────────────────
  INSERT INTO repair_histories (
    store_id, customer_id, child_id,
    slip_number, item_name, content,
    status, request_type,
    received_date, completed_date,
    price, prepaid, payment_status,
    desired_completion_date, notified,
    created_at, updated_at
  ) VALUES

    -- ① お直し: 期限3日超過・未払い（最優先）
    (v_store_id, c1, ch1,
     'R001', '○○中学校 スラックス', '裾上げ 3cm',
     'received', 'repair',
     CURRENT_DATE - 14, NULL,
     1200, false, 'unpaid',
     CURRENT_DATE - 3, false,
     now(), now()),

    -- ② お直し: 明日期限・支払済み（要対応）
    (v_store_id, c2, ch2,
     'R002', '○○高校 スカート', 'ウエスト詰め 2cm',
     'received', 'repair',
     CURRENT_DATE - 7, NULL,
     1500, true, 'paid',
     CURRENT_DATE + 1, false,
     now(), now()),

    -- ③ お直し: 1週間後期限・未払い（通常）
    (v_store_id, c3, ch3,
     'R003', '○○中学校 ブレザー', '袖丈詰め 左右各1cm',
     'received', 'repair',
     CURRENT_DATE - 5, NULL,
     2000, false, 'unpaid',
     CURRENT_DATE + 7, false,
     now(), now()),

    -- ④ お直し: 完了済みお渡し待ち・未払い（代金回収注意）
    (v_store_id, c4, ch4,
     'R004', '○○高校 スラックス', '裾上げ 5cm',
     'completed', 'repair',
     CURRENT_DATE - 10, CURRENT_DATE - 2,
     1200, false, 'unpaid',
     NULL, true,
     now(), now()),

    -- ⑤ お直し: 完了済みお渡し待ち・支払済み
    (v_store_id, c1, ch1,
     'R005', '○○中学校 セーラー服', '身丈詰め 2cm',
     'completed', 'repair',
     CURRENT_DATE - 12, CURRENT_DATE - 5,
     1800, true, 'paid',
     NULL, true,
     now(), now()),

    -- ⑥ 来店依頼（問い合わせ）: 採寸・サイズ確認
    (v_store_id, c5, NULL,
     NULL, '採寸・サイズ確認', '○○中学校入学準備 制服一式の採寸希望',
     'received', 'walk_in',
     CURRENT_DATE - 2, NULL,
     NULL, false, NULL,
     CURRENT_DATE + 5, false,
     now(), now()),

    -- ⑦ 来店依頼（問い合わせ）: 商品確認・相談
    (v_store_id, c2, ch2,
     NULL, '制服追加購入相談', '体育祭用 ジャージのサイズ確認と購入相談',
     'received', 'walk_in',
     CURRENT_DATE - 1, NULL,
     NULL, false, NULL,
     CURRENT_DATE + 3, false,
     now(), now()),

    -- ⑧ 取置き依頼: 支払済み（通常）
    (v_store_id, c4, ch4,
     NULL, '○○高校 夏服 ブラウス', 'Mサイズ 2枚 取置き希望',
     'received', 'hold_request',
     CURRENT_DATE - 3, NULL,
     7600, true, 'paid',
     CURRENT_DATE + 10, false,
     now(), now()),

    -- ⑨ 取置き依頼: 完了・未払い（お渡し待ち）
    (v_store_id, c3, ch3,
     NULL, '○○中学校 冬服 セーター', 'Lサイズ 1枚 確保済み',
     'completed', 'hold_request',
     CURRENT_DATE - 8, CURRENT_DATE - 1,
     4200, false, 'unpaid',
     NULL, true,
     now(), now()),

    -- ⑩ お直し: 期限なし・未払い（通常作業）
    (v_store_id, c5, NULL,
     'R010', '体操服 Tシャツ', 'ネーム刺繍 名前入れ: 伊藤 恵美',
     'received', 'repair',
     CURRENT_DATE - 4, NULL,
     500, false, 'unpaid',
     NULL, false,
     now(), now());

  -- ──────────────────────────────────────────────────────────
  -- 追加購入 (purchase_orders) — 7件
  -- ──────────────────────────────────────────────────────────
  INSERT INTO purchase_orders (
    store_id, customer_id, child_id,
    item_name, maker, notes,
    status, price,
    ordered_date, arrived_date, delivered_date,
    notified, payment_status,
    created_at, updated_at
  ) VALUES

    -- ① 依頼受付中（未発注）— カンコー
    (v_store_id, c1, ch1,
     '○○中学校 夏服 半袖シャツ Mサイズ', 'カンコー',
     '2枚追加希望・急ぎ',
     'received', 2200,
     CURRENT_DATE - 4, NULL, NULL,
     false, 'unpaid',
     now(), now()),

    -- ② 依頼受付中（未発注）— カンコー（同メーカー）
    (v_store_id, c4, ch4,
     '○○高校 通学バッグ 黒', 'カンコー',
     '黒色・Aタイプ希望',
     'received', 6800,
     CURRENT_DATE - 2, NULL, NULL,
     false, 'unpaid',
     now(), now()),

    -- ③ メーカー発注済み — トンボ
    (v_store_id, c2, ch2,
     '○○高校 体操服 上下セット Lサイズ', 'トンボ',
     '急ぎで発注希望',
     'on_order', 4500,
     CURRENT_DATE - 7, NULL, NULL,
     false, 'unpaid',
     now(), now()),

    -- ④ メーカー発注済み — トンボ（同メーカー）
    (v_store_id, c5, NULL,
     'ネーム刺繍 追加分', 'トンボ',
     '伊藤 恵美 と入れてください',
     'on_order', 800,
     CURRENT_DATE - 5, NULL, NULL,
     false, 'unpaid',
     now(), now()),

    -- ⑤ 入荷済み・お渡し待ち・未払い（要回収）
    (v_store_id, c3, ch3,
     '○○中学校 スポーツジャージ上 Lサイズ', 'ミズノ',
     NULL,
     'arrived', 3800,
     CURRENT_DATE - 14, CURRENT_DATE - 2, NULL,
     true, 'unpaid',
     now(), now()),

    -- ⑥ 入荷済み・お渡し待ち・支払済み
    (v_store_id, c4, ch4,
     '○○高校 夏服 ポロシャツ Sサイズ', 'カンコー',
     NULL,
     'arrived', 2800,
     CURRENT_DATE - 10, CURRENT_DATE - 3, NULL,
     true, 'paid',
     now(), now()),

    -- ⑦ 在庫確保済み（店頭取り置き）
    (v_store_id, c1, ch1,
     '○○中学校 冬服 ズボン Mサイズ', 'カンコー',
     '来月まで取り置き希望',
     'stocked', 5200,
     CURRENT_DATE - 6, CURRENT_DATE - 6, NULL,
     false, 'unpaid',
     now(), now());

  RAISE NOTICE '✅ テストデータを投入しました';
  RAISE NOTICE '   顧客: 5件 / お子様: 4件';
  RAISE NOTICE '   お直し履歴: 10件（お直し5件・来店依頼2件・取置き3件）';
  RAISE NOTICE '   追加購入: 7件（未発注2件・発注済み2件・入荷済み2件・確保済み1件）';
  RAISE NOTICE '   対象店舗ID: %', v_store_id;
END $$;

-- ──────────────────────────────────────────────────────────────
-- ✅ 確認クエリ（投入後に実行してください）
-- ──────────────────────────────────────────────────────────────
-- SELECT r.slip_number, r.item_name, r.status, r.request_type, r.price, r.prepaid,
--        c.name AS customer, ch.name AS child
-- FROM repair_histories r
-- LEFT JOIN customers c ON c.id = r.customer_id
-- LEFT JOIN children ch ON ch.id = r.child_id
-- WHERE r.notes IS NULL
-- ORDER BY r.created_at DESC LIMIT 20;
--
-- SELECT p.item_name, p.status, p.maker, p.price,
--        c.name AS customer, ch.name AS child
-- FROM purchase_orders p
-- LEFT JOIN customers c ON c.id = p.customer_id
-- LEFT JOIN children ch ON ch.id = p.child_id
-- ORDER BY p.created_at DESC LIMIT 20;
