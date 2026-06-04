-- ============================================================
-- 学生服加工料金マスタ 一括登録（2026/10改定）
-- 全店舗対象・既存データはスキップ（上書きなし）
-- Supabase SQL Editor で実行してください
-- ============================================================

DO $$
DECLARE
  v_store  RECORD;
  v_cat_id uuid;
BEGIN

FOR v_store IN SELECT id::text AS id, name FROM stores ORDER BY name LOOP
  RAISE NOTICE '▶ 店舗: % (%)', v_store.name, v_store.id;

  -- ──────────────────────────────────────────────────────────
  -- ① ジャケット上着
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'ジャケット上着';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'ジャケット上着', 1, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '袖丈 詰め・出し',                       'sleeve',        2000::int, null::text),
      (2, '袖丈 詰め（内あげ手まつり）',            'sleeve',        1800,      null),
      (3, 'ボタン付け（1箇所）',                   'button',         200,      null),
      (4, '袖丈 詰め グローイング',                 'sleeve',        4000,      'グローイング'),
      (5, '袖丈 詰め グローイング ダブル',          'sleeve',        8000,      'グローイング ダブル'),
      (6, '脇・バスト 詰め（グローイング）',        'size_exchange', 4000,      'グローイング'),
      (7, '肩巾 詰め',                             'other',         9000,      null),
      (8, '着丈 詰め・出し（グローイング）',        'other',         4000,      'グローイング'),
      (9, 'グローイング以外のお直し（脇幅・着丈）', 'other',         null,      'お見積り')
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ② 詰襟学生服上着
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = '詰襟学生服上着';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, '詰襟学生服上着', 2, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '衿取替え',                'other',  3500::int, null::text),
      (2, 'かぎホック直し',          'tear',    900,      null),
      (3, '衿吊り交換',              'other',   900,      null),
      (4, 'チェンジボタン（5箇所）', 'button',  600,      null),
      (5, 'しつけ',                  'other',   500,      null),
      (6, 'バッチ交換（プレス）',    'badge',   400,      null),
      (7, '氏名片布付',              'other',   600,      null),
      (8, 'レザー交換裏地ほどき有り','tear',   1700,      '裏地ほどき有り')
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ③ スラックス
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'スラックス';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'スラックス', 3, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      ( 1, '裾丈（シングル）靴ずれなし',     'hem',   700::int, '加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000'::text),
      ( 2, '裾丈（シングル）靴ずれあり',     'hem',   900,      '靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000'),
      ( 3, '裾丈（ダブル）靴ずれなし',       'hem',  1200,      'ダブル / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000'),
      ( 4, '裾丈（ダブル）靴ずれあり',       'hem',  1400,      'ダブル・靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000'),
      ( 5, '裾丈（グローイング）靴ずれなし', 'hem',  2000,      'グローイング'),
      ( 6, '裾丈（グローイング）靴ずれあり', 'hem',  2200,      'グローイング・靴ずれあり'),
      ( 7, '靴ずれ付け',                     'hem',   500,      null),
      ( 8, 'ウエスト詰め・出し',           'waist',  1800,      null),
      ( 9, 'ウエスト三方詰め',             'waist',  4400,      null),
      (10, 'ベルトループ移動（一箇所）',   'other',   200,      null),
      (11, 'ファスナー取替え',              'tear',  2800,      null),
      (12, '前カン取替え',                  'tear',  1600,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ④ スカート
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'スカート';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'スカート', 4, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '裾から丈詰・出し（ボックス）',         'hem',   2700::int, null::text),
      (2, '裾から丈詰・出し（車ひだ）',           'hem',   3100,      null),
      (3, 'ウエストから丈詰・出し（車ひだ）',     'waist', 4000,      'ウエストから丈調整'),
      (4, 'ウエストから丈詰・出し（ボックス）',   'waist', 6000,      'ウエストから丈調整'),
      (5, 'ウエスト 詰め・出し',                 'waist', 3500,      null),
      (6, 'ウエスト グローイング仕様',           'waist', 1800,      'グローイング'),
      (7, 'ウエスト 詰め・出し（ベルト作成要）', 'waist', 4600,      'ベルト作成込み'),
      (8, '3段カン→アジャスターに交換',          'other', 1000,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ⑤ セーラー服
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'セーラー服';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'セーラー服', 5, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '袖丈 詰め・出し',     'sleeve', 3000::int, '小学校セーラー対応+2000'::text),
      (2, '肩幅 詰め',           'other',  5400,      null),
      (3, '脇巾 詰め',           'other',  4000,      null),
      (4, 'ボタン付け（1箇所）', 'button',  200,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ⑥ ベスト
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'ベスト';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'ベスト', 6, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '脇巾・バスト 詰め', 'other', 3200::int, null::text),
      (2, '肩巾 詰め',         'other', 2800,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ⑦ コート
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'コート';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'コート', 7, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, '袖丈 詰め・出し（尾錠移動あり）', 'sleeve', 3200::int, '尾錠移動あり'::text),
      (2, '着丈 詰め・出し',                 'other',  4000,      null),
      (3, 'トグル付け（1個）',               'button', 1000,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  -- ──────────────────────────────────────────────────────────
  -- ⑧ エンブレム・その他
  -- ──────────────────────────────────────────────────────────
  SELECT id INTO v_cat_id FROM repair_item_categories WHERE store_id = v_store.id AND name = 'エンブレム・その他';
  IF v_cat_id IS NULL THEN
    INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
      VALUES (v_store.id, 'エンブレム・その他', 8, true) RETURNING id INTO v_cat_id;
  END IF;
  INSERT INTO repair_price_presets (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
    SELECT v_store.id, v_cat_id, t.item_name, t.repair_type, t.default_price, t.notes, t.sort_order, true
    FROM (VALUES
      (1, 'エンブレム付け（ミシン）大',               'embroidery', 1600::int, '裏地ほどき有り+700'::text),
      (2, 'エンブレム付け（ミシン）小',               'embroidery', 1300,      '裏地ほどき有り+700'),
      (3, 'エンブレム付け（手縫い）大',               'embroidery', 2200,      null),
      (4, 'エンブレム付け（手縫い）小',               'embroidery', 1700,      null),
      (5, '仕上げ（袋入れ・たたみ・シール貼りなど）', 'other',       300,      null),
      (6, '伝票記入代（1枚）',                        'other',       300,      null)
    ) AS t(sort_order, item_name, repair_type, default_price, notes)
    WHERE NOT EXISTS (
      SELECT 1 FROM repair_price_presets rp
       WHERE rp.store_id = v_store.id AND rp.category_id = v_cat_id AND rp.item_name = t.item_name
    );

  RAISE NOTICE '  ✓ 完了';

END LOOP;

RAISE NOTICE '========================================';
RAISE NOTICE '全店舗への登録完了（既存はスキップ済み）';
RAISE NOTICE '========================================';

END $$;

-- ── 登録確認クエリ（実行後にコメントアウトを外して確認） ──────────
/*
SELECT
  s.name      AS 店舗名,
  c.name      AS 服種,
  COUNT(p.id) AS プリセット数
FROM stores s
JOIN repair_item_categories c ON c.store_id = s.id
JOIN repair_price_presets   p ON p.store_id = s.id AND p.category_id = c.id
GROUP BY s.name, c.name, c.sort_order
ORDER BY s.name, c.sort_order;
*/
