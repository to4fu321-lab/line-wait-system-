-- ============================================================
-- テストデータ一括登録（全店舗）
-- 実行場所: Supabase SQL Editor
-- 前提: migrate_store_id_to_uuid.sql を先に実行して store_id を uuid に統一済みであること
-- 内容: 全顧客・注文データ削除 → 学校5校・商品25点・価格125件・スタッフ3名を全店舗に登録
-- ============================================================

DO $$
DECLARE
  v_store_ids uuid[];
  v_sid       uuid;
  v_school1   uuid;
  v_school2   uuid;
  v_school3   uuid;
  v_school4   uuid;
  v_school5   uuid;
  v_cust_ids  uuid[];
BEGIN

  SELECT ARRAY(SELECT id FROM stores) INTO v_store_ids;

  FOREACH v_sid IN ARRAY v_store_ids LOOP
    RAISE NOTICE '処理中: %', v_sid;

    -- ① 顧客・注文データを全削除
    SELECT ARRAY(SELECT id FROM customers WHERE store_id = v_sid) INTO v_cust_ids;
    UPDATE queues SET customer_id = NULL, child_id = NULL WHERE store_id = v_sid;
    DELETE FROM repair_histories WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM purchase_orders  WHERE customer_id = ANY(v_cust_ids);
    DELETE FROM queues           WHERE store_id = v_sid;
    DELETE FROM children         WHERE store_id = v_sid OR customer_id = ANY(v_cust_ids);
    DELETE FROM customers        WHERE store_id = v_sid;
    DELETE FROM school_product_variants WHERE store_id = v_sid;
    DELETE FROM school_products         WHERE store_id = v_sid;
    DELETE FROM schools                 WHERE store_id = v_sid;
    DELETE FROM staff                   WHERE store_id = v_sid;

    -- ② 学校5校
    v_school1 := gen_random_uuid();
    v_school2 := gen_random_uuid();
    v_school3 := gen_random_uuid();
    v_school4 := gen_random_uuid();
    v_school5 := gen_random_uuid();

    INSERT INTO schools (id, store_id, name, short_name, sort_order, active) VALUES
      (v_school1, v_sid, '桜ヶ丘中学校', '桜中',    1, true),
      (v_school2, v_sid, '北星高等学校', '北星高',   2, true),
      (v_school3, v_sid, '青葉台中学校', '青葉台中', 3, true),
      (v_school4, v_sid, '南山高等学校', '南山高',   4, true),
      (v_school5, v_sid, '西城中学校',   '西城中',   5, true);

    -- ③ 商品5点 × 5校
    INSERT INTO school_products
      (id, store_id, school_id, item_name, maker_code, color_code, category, gender, sort_order, active)
    VALUES
      (gen_random_uuid(), v_sid, v_school1, 'ブレザー（男子）',       'BL-101', '紺',          '制服（上着）',         '男子用',   1, true),
      (gen_random_uuid(), v_sid, v_school1, 'スラックス（男子）',     'SL-101', '紺',          'スラックス・スカート', '男子用',   2, true),
      (gen_random_uuid(), v_sid, v_school1, 'スカート（女子）',       'SK-101', 'チェック',    'スラックス・スカート', '女子用',   3, true),
      (gen_random_uuid(), v_sid, v_school1, 'ワイシャツ（男女共通）', 'SH-101', '白',          'シャツ・ブラウス',     '男女共通', 4, true),
      (gen_random_uuid(), v_sid, v_school1, '体操着上着（男女共通）', 'GY-101', '白/紺',       '体操着',               '男女共通', 5, true),
      (gen_random_uuid(), v_sid, v_school2, '学ラン上着（男子）',     'GK-201', '黒',          '制服（上着）',         '男子用',   1, true),
      (gen_random_uuid(), v_sid, v_school2, 'スラックス（男子）',     'SL-201', '黒',          'スラックス・スカート', '男子用',   2, true),
      (gen_random_uuid(), v_sid, v_school2, 'セーラー服（女子）',     'SR-201', '紺',          '制服（上着）',         '女子用',   3, true),
      (gen_random_uuid(), v_sid, v_school2, 'スカーフ（女子）',       'SC-201', '赤',          'ネクタイ・リボン',     '女子用',   4, true),
      (gen_random_uuid(), v_sid, v_school2, '体操着上着（男女共通）', 'GY-201', '白/黒',       '体操着',               '男女共通', 5, true),
      (gen_random_uuid(), v_sid, v_school3, 'ブレザー（男子）',       'BL-301', 'グレー',      '制服（上着）',         '男子用',   1, true),
      (gen_random_uuid(), v_sid, v_school3, 'スラックス（男子）',     'SL-301', 'グレー',      'スラックス・スカート', '男子用',   2, true),
      (gen_random_uuid(), v_sid, v_school3, 'スカート（女子）',       'SK-301', 'チェック',    'スラックス・スカート', '女子用',   3, true),
      (gen_random_uuid(), v_sid, v_school3, 'ブラウス（女子）',       'BL-302', '白',          'シャツ・ブラウス',     '女子用',   4, true),
      (gen_random_uuid(), v_sid, v_school3, '体操着上着（男女共通）', 'GY-301', '白/グレー',   '体操着',               '男女共通', 5, true),
      (gen_random_uuid(), v_sid, v_school4, 'ブレザー（男子）',       'BL-401', '紺',          '制服（上着）',         '男子用',   1, true),
      (gen_random_uuid(), v_sid, v_school4, 'スラックス（男子）',     'SL-401', '紺縦縞',      'スラックス・スカート', '男子用',   2, true),
      (gen_random_uuid(), v_sid, v_school4, 'スカート（女子）',       'SK-401', '紺チェック',  'スラックス・スカート', '女子用',   3, true),
      (gen_random_uuid(), v_sid, v_school4, 'ネクタイ（男子）',       'NT-401', '赤ストライプ','ネクタイ・リボン',     '男子用',   4, true),
      (gen_random_uuid(), v_sid, v_school4, '体操着上着（男女共通）', 'GY-401', '白/紺',       '体操着',               '男女共通', 5, true),
      (gen_random_uuid(), v_sid, v_school5, 'ブレザー（男子）',       'BL-501', '黒',          '制服（上着）',         '男子用',   1, true),
      (gen_random_uuid(), v_sid, v_school5, 'スラックス（男子）',     'SL-501', '黒',          'スラックス・スカート', '男子用',   2, true),
      (gen_random_uuid(), v_sid, v_school5, 'スカート（女子）',       'SK-501', '黒チェック',  'スラックス・スカート', '女子用',   3, true),
      (gen_random_uuid(), v_sid, v_school5, 'ブラウス（女子）',       'BL-502', '白',          'シャツ・ブラウス',     '女子用',   4, true),
      (gen_random_uuid(), v_sid, v_school5, '体操着上着（男女共通）', 'GY-501', '白/黒',       '体操着',               '男女共通', 5, true);

    -- ④ 全商品にサイズ・価格（5サイズ × 25点 = 125件）
    INSERT INTO school_product_variants
      (id, product_id, store_id, size_label, price, cost, stock, active, sort_order)
    SELECT
      gen_random_uuid(),
      sp.id,
      sp.store_id,
      sz.size_label,
      CASE sp.category
        WHEN '制服（上着）'         THEN sz.p_upper
        WHEN 'スラックス・スカート' THEN sz.p_bottom
        WHEN 'シャツ・ブラウス'     THEN sz.p_shirt
        WHEN 'ネクタイ・リボン'     THEN sz.p_tie
        WHEN '体操着'               THEN sz.p_gym
        ELSE sz.p_upper
      END,
      NULL, 10, true, sz.sort_order
    FROM school_products AS sp
    CROSS JOIN (VALUES
      ('150cm', 28000, 8500, 4800, 1500, 6500, 1),
      ('155cm', 29000, 8800, 4900, 1500, 6800, 2),
      ('160cm', 30000, 9000, 5000, 1500, 7000, 3),
      ('165cm', 31000, 9200, 5100, 1500, 7200, 4),
      ('170cm', 32000, 9500, 5200, 1500, 7500, 5)
    ) AS sz(size_label, p_upper, p_bottom, p_shirt, p_tie, p_gym, sort_order)
    WHERE sp.store_id = v_sid;

    -- ⑤ スタッフ3名
    INSERT INTO staff (id, store_id, name, kana, role, color, pin, active, sort_order) VALUES
      (gen_random_uuid(), v_sid, '田中 恵子',   'タナカ ケイコ',   '店長',    '#6366f1', '1111', true, 1),
      (gen_random_uuid(), v_sid, '佐藤 みゆき', 'サトウ ミユキ',   'リーダー','#ec4899', '2222', true, 2),
      (gen_random_uuid(), v_sid, '鈴木 大輔',   'スズキ ダイスケ', 'スタッフ','#10b981', '3333', true, 3);

    -- school_names を同期（CRM・受付フォーム用）
    UPDATE stores
    SET school_names = ARRAY['桜ヶ丘中学校','北星高等学校','青葉台中学校','南山高等学校','西城中学校']
    WHERE id = v_sid;

    RAISE NOTICE '完了: %', v_sid;
  END LOOP;

  RAISE NOTICE '全店舗処理完了';
END;
$$;
