-- ============================================================
-- 学生服加工料金マスタ 一括登録（2026/10改定）
-- 全店舗対象・既存データはスキップ（上書きなし）
-- Supabase SQL Editor で実行してください
-- ============================================================

DO $$
DECLARE
  v_store  RECORD;
  v_cat_id uuid;

  -- カテゴリ取得or作成ヘルパー
  PROCEDURE upsert_category(p_store_id text, p_name text, p_sort int, OUT out_id uuid) AS $proc$
  BEGIN
    SELECT id INTO out_id
      FROM repair_item_categories
     WHERE store_id = p_store_id AND name = p_name
     LIMIT 1;
    IF out_id IS NULL THEN
      INSERT INTO repair_item_categories (store_id, name, sort_order, is_active)
        VALUES (p_store_id, p_name, p_sort, true)
        RETURNING id INTO out_id;
    END IF;
  END $proc$ LANGUAGE plpgsql;

  -- プリセット追加ヘルパー（同 category_id + item_name が未登録のときだけ）
  PROCEDURE insert_preset(
    p_store_id text, p_cat_id uuid, p_item text, p_type text,
    p_price int, p_notes text, p_sort int
  ) AS $proc$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM repair_price_presets
       WHERE store_id = p_store_id AND category_id = p_cat_id AND item_name = p_item
    ) THEN
      INSERT INTO repair_price_presets
        (store_id, category_id, item_name, repair_type, default_price, notes, sort_order, is_active)
      VALUES
        (p_store_id, p_cat_id, p_item, p_type, p_price, p_notes, p_sort, true);
    END IF;
  END $proc$ LANGUAGE plpgsql;

BEGIN

FOR v_store IN SELECT id, name FROM stores ORDER BY name LOOP
  RAISE NOTICE '▶ 店舗: % (%)', v_store.name, v_store.id;

  -- ① ジャケット上着 ─────────────────────────────────
  CALL upsert_category(v_store.id, 'ジャケット上着', 1, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め・出し',                       'sleeve',        2000, null,                  1);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め（内あげ手まつり）',            'sleeve',        1800, null,                  2);
  CALL insert_preset(v_store.id, v_cat_id, 'ボタン付け（1箇所）',                   'button',         200, null,                  3);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め グローイング',                 'sleeve',        4000, 'グローイング',         4);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め グローイング ダブル',          'sleeve',        8000, 'グローイング ダブル',   5);
  CALL insert_preset(v_store.id, v_cat_id, '脇・バスト 詰め（グローイング）',        'size_exchange', 4000, 'グローイング',         6);
  CALL insert_preset(v_store.id, v_cat_id, '肩巾 詰め',                             'other',         9000, null,                  7);
  CALL insert_preset(v_store.id, v_cat_id, '着丈 詰め・出し（グローイング）',        'other',         4000, 'グローイング',         8);
  CALL insert_preset(v_store.id, v_cat_id, 'グローイング以外のお直し（脇幅・着丈）', 'other',          null, 'お見積り',            9);

  -- ② 詰襟学生服上着 ────────────────────────────────
  CALL upsert_category(v_store.id, '詰襟学生服上着', 2, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '衿取替え',                'other',  3500, null,             1);
  CALL insert_preset(v_store.id, v_cat_id, 'かぎホック直し',          'tear',    900, null,             2);
  CALL insert_preset(v_store.id, v_cat_id, '衿吊り交換',              'other',   900, null,             3);
  CALL insert_preset(v_store.id, v_cat_id, 'チェンジボタン（5箇所）', 'button',  600, null,             4);
  CALL insert_preset(v_store.id, v_cat_id, 'しつけ',                  'other',   500, null,             5);
  CALL insert_preset(v_store.id, v_cat_id, 'バッチ交換（プレス）',    'badge',   400, null,             6);
  CALL insert_preset(v_store.id, v_cat_id, '氏名片布付',              'other',   600, null,             7);
  CALL insert_preset(v_store.id, v_cat_id, 'レザー交換裏地ほどき有り','tear',   1700, '裏地ほどき有り', 8);

  -- ③ スラックス ────────────────────────────────────
  CALL upsert_category(v_store.id, 'スラックス', 3, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（シングル）靴ずれなし',     'hem',  700,  '加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000',  1);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（シングル）靴ずれあり',     'hem',  900,  '靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000', 2);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（ダブル）靴ずれなし',       'hem', 1200,  'ダブル / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000', 3);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（ダブル）靴ずれあり',       'hem', 1400,  'ダブル・靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000', 4);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（グローイング）靴ずれなし', 'hem', 2000,  'グローイング',           5);
  CALL insert_preset(v_store.id, v_cat_id, '裾丈（グローイング）靴ずれあり', 'hem', 2200,  'グローイング・靴ずれあり', 6);
  CALL insert_preset(v_store.id, v_cat_id, '靴ずれ付け',                     'hem',  500,  null,                     7);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエスト詰め・出し',           'waist', 1800,  null,                     8);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエスト三方詰め',             'waist', 4400,  null,                     9);
  CALL insert_preset(v_store.id, v_cat_id, 'ベルトループ移動（一箇所）',   'other',  200,  null,                    10);
  CALL insert_preset(v_store.id, v_cat_id, 'ファスナー取替え',              'tear', 2800,  null,                    11);
  CALL insert_preset(v_store.id, v_cat_id, '前カン取替え',                  'tear', 1600,  null,                    12);

  -- ④ スカート ──────────────────────────────────────
  CALL upsert_category(v_store.id, 'スカート', 4, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '裾から丈詰・出し（ボックス）',         'hem',   2700, null,               1);
  CALL insert_preset(v_store.id, v_cat_id, '裾から丈詰・出し（車ひだ）',           'hem',   3100, null,               2);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエストから丈詰・出し（車ひだ）',     'waist', 4000, 'ウエストから丈調整', 3);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエストから丈詰・出し（ボックス）',   'waist', 6000, 'ウエストから丈調整', 4);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエスト 詰め・出し',                 'waist', 3500, null,               5);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエスト グローイング仕様',           'waist', 1800, 'グローイング',      6);
  CALL insert_preset(v_store.id, v_cat_id, 'ウエスト 詰め・出し（ベルト作成要）', 'waist', 4600, 'ベルト作成込み',    7);
  CALL insert_preset(v_store.id, v_cat_id, '3段カン→アジャスターに交換',          'other', 1000, null,               8);

  -- ⑤ セーラー服 ────────────────────────────────────
  CALL upsert_category(v_store.id, 'セーラー服', 5, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め・出し',     'sleeve', 3000, '小学校セーラー対応+2000', 1);
  CALL insert_preset(v_store.id, v_cat_id, '肩幅 詰め',           'other',  5400, null,                      2);
  CALL insert_preset(v_store.id, v_cat_id, '脇巾 詰め',           'other',  4000, null,                      3);
  CALL insert_preset(v_store.id, v_cat_id, 'ボタン付け（1箇所）', 'button',  200, null,                      4);

  -- ⑥ ベスト ────────────────────────────────────────
  CALL upsert_category(v_store.id, 'ベスト', 6, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '脇巾・バスト 詰め', 'other', 3200, null, 1);
  CALL insert_preset(v_store.id, v_cat_id, '肩巾 詰め',         'other', 2800, null, 2);

  -- ⑦ コート ────────────────────────────────────────
  CALL upsert_category(v_store.id, 'コート', 7, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, '袖丈 詰め・出し（尾錠移動あり）', 'sleeve', 3200, '尾錠移動あり', 1);
  CALL insert_preset(v_store.id, v_cat_id, '着丈 詰め・出し',                 'other',  4000, null,           2);
  CALL insert_preset(v_store.id, v_cat_id, 'トグル付け（1個）',               'button', 1000, null,           3);

  -- ⑧ エンブレム・その他 ────────────────────────────
  CALL upsert_category(v_store.id, 'エンブレム・その他', 8, v_cat_id);
  CALL insert_preset(v_store.id, v_cat_id, 'エンブレム付け（ミシン）大',               'embroidery', 1600, '裏地ほどき有り+700', 1);
  CALL insert_preset(v_store.id, v_cat_id, 'エンブレム付け（ミシン）小',               'embroidery', 1300, '裏地ほどき有り+700', 2);
  CALL insert_preset(v_store.id, v_cat_id, 'エンブレム付け（手縫い）大',               'embroidery', 2200, null,               3);
  CALL insert_preset(v_store.id, v_cat_id, 'エンブレム付け（手縫い）小',               'embroidery', 1700, null,               4);
  CALL insert_preset(v_store.id, v_cat_id, '仕上げ（袋入れ・たたみ・シール貼りなど）', 'other',       300, null,               5);
  CALL insert_preset(v_store.id, v_cat_id, '伝票記入代（1枚）',                        'other',       300, null,               6);

  RAISE NOTICE '  ✓ 完了';

END LOOP;

RAISE NOTICE '========================================';
RAISE NOTICE '全店舗への登録完了（既存はスキップ済み）';
RAISE NOTICE '========================================';

END $$;

-- ── 登録確認クエリ（実行後にコメントアウトを外して確認） ──
/*
SELECT
  s.name        AS 店舗名,
  c.name        AS 服種,
  COUNT(p.id)   AS プリセット数
FROM stores s
JOIN repair_item_categories c ON c.store_id = s.id
JOIN repair_price_presets   p ON p.store_id = s.id AND p.category_id = c.id
GROUP BY s.name, c.name
ORDER BY s.name, c.sort_order;
*/
