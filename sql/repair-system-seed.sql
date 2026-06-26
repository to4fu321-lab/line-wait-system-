-- ============================================================================
--  お直しマスタ 初期データ投入（全店舗に標準セットを配布）
--  2026-06-14  Claude Code
--
--  再実行可能: 既に同 code の服種がある店舗はスキップ。
--  服種 > 項目 > オプション の代表セット。残りは管理画面から追加する想定。
-- ============================================================================

DO $seed$
DECLARE
  s          record;
  g_slacks   uuid; g_skirt uuid; g_jacket uuid; g_shirt uuid; g_other uuid;
  i_hem      uuid; i_waist uuid; i_emb uuid;
BEGIN
  FOR s IN SELECT id FROM public.stores LOOP
    -- 既に投入済みの店舗はスキップ
    IF EXISTS (SELECT 1 FROM public.repair_garment_types WHERE store_id = s.id) THEN
      CONTINUE;
    END IF;

    -- ── 服種 ──────────────────────────────────────────────
    INSERT INTO public.repair_garment_types (store_id, code, name, icon, sort_order)
    VALUES (s.id, 'slacks', 'スラックス', '👖', 10) RETURNING id INTO g_slacks;
    INSERT INTO public.repair_garment_types (store_id, code, name, icon, sort_order)
    VALUES (s.id, 'skirt', 'スカート', '👗', 20) RETURNING id INTO g_skirt;
    INSERT INTO public.repair_garment_types (store_id, code, name, icon, sort_order)
    VALUES (s.id, 'jacket', '上着（ブレザー・学ラン）', '🧥', 30) RETURNING id INTO g_jacket;
    INSERT INTO public.repair_garment_types (store_id, code, name, icon, sort_order)
    VALUES (s.id, 'shirt', 'シャツ・ブラウス', '👔', 40) RETURNING id INTO g_shirt;
    INSERT INTO public.repair_garment_types (store_id, code, name, icon, sort_order)
    VALUES (s.id, 'other', 'その他', '📦', 90) RETURNING id INTO g_other;

    -- ── スラックス 項目 ──────────────────────────────────
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_slacks, 'hem', '裾上げ', '✂️', 1200, 'per_item',
      '[{"key":"hem_length_mm","label":"仕上がり丈","unit":"mm","required":true},{"key":"fold_keep_mm","label":"折り返し残し","unit":"mm","required":false}]'::jsonb,
      5, 10)
    RETURNING id INTO i_hem;
    -- 裾上げ オプション
    INSERT INTO public.repair_options (store_id, item_id, group_label, group_select, code, name, price_delta, default_selected, sort_order) VALUES
      (s.id, i_hem, '仕上げ方法', 'single', 'matsuri',  'まつり縫い',       0,   true,  10),
      (s.id, i_hem, '仕上げ方法', 'single', 'stitch',   'シングルステッチ', 200, false, 20),
      (s.id, i_hem, '仕上げ方法', 'single', 'chidori',  '千鳥がけ',         300, false, 30),
      (s.id, i_hem, NULL,         'multi',  'nonslip',  'すべり止めテープ', 200, false, 40);
    -- 特殊素材（選ぶと見積もりモード + 注意画像）
    INSERT INTO public.repair_options (store_id, item_id, group_label, group_select, code, name, price_delta, requires_quote, manual, sort_order)
    VALUES (s.id, i_hem, NULL, 'multi', 'special_fabric', '特殊素材（撥水・防シワ等）', 0, true,
      '{"title":"特殊素材の裾上げ注意","body":"アイロン温度に注意。千鳥不可。職人確認のうえ個別見積もり。","severity":"danger","images":[]}'::jsonb,
      50);

    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_slacks, 'waist', 'ウエスト詰め・出し', '📏', 1500, 'per_item',
      '[{"key":"waist_adjust_mm","label":"増減量","unit":"mm","required":true}]'::jsonb, 5, 20);

    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, requires_quote, sort_order)
    VALUES (s.id, g_slacks, 'tear', '補修・かけつぎ', '🩹', 1000, 'per_item', 7, false, 30);

    -- ── スカート 項目 ────────────────────────────────────
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_skirt, 'hem', '丈詰め', '✂️', 1500, 'per_item',
      '[{"key":"hem_length_mm","label":"仕上がり丈","unit":"mm","required":true}]'::jsonb, 5, 10);
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_skirt, 'waist', 'ウエスト調整', '📏', 1500, 'per_item',
      '[{"key":"waist_adjust_mm","label":"増減量","unit":"mm","required":true}]'::jsonb, 5, 20);

    -- ── 上着 項目 ────────────────────────────────────────
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_jacket, 'sleeve', '袖丈直し', '👔', 2000, 'per_item',
      '[{"key":"sleeve_adjust_mm","label":"袖丈増減","unit":"mm","required":true}]'::jsonb, 7, 10);
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, sort_order)
    VALUES (s.id, g_jacket, 'badge', '校章付け', '🏅', 500, 'per_item', 3, 20);
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, sort_order)
    VALUES (s.id, g_jacket, 'button', 'ボタン付け替え', '🔘', 300, 'per_item', 3, 30);
    -- ネーム刺繍（文字単価 per_name）
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, measurements, lead_time_days, sort_order)
    VALUES (s.id, g_jacket, 'embroidery', 'ネーム刺繍', '🔤', 100, 'per_name',
      '[{"key":"text","label":"刺繍文字","unit":"文字","required":true}]'::jsonb, 7, 40)
    RETURNING id INTO i_emb;
    INSERT INTO public.repair_options (store_id, item_id, group_label, group_select, code, name, price_delta, default_selected, sort_order) VALUES
      (s.id, i_emb, '書体', 'single', 'gothic', 'ゴシック体', 0,   true,  10),
      (s.id, i_emb, '書体', 'single', 'mincho', '明朝体',     0,   false, 20),
      (s.id, i_emb, '色',   'single', 'navy',   '紺',         0,   true,  30),
      (s.id, i_emb, '色',   'single', 'white',  '白',         0,   false, 40),
      (s.id, i_emb, '色',   'single', 'gold',   '金（+料金）', 100, false, 50);
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, sort_order)
    VALUES (s.id, g_jacket, 'tear', '補修・かけつぎ', '🩹', 1200, 'per_item', 7, 50);

    -- ── シャツ・ブラウス 項目 ────────────────────────────
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, sort_order)
    VALUES (s.id, g_shirt, 'tear', '補修', '🩹', 800, 'per_item', 5, 10);
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, sort_order)
    VALUES (s.id, g_shirt, 'button', 'ボタン付け替え', '🔘', 300, 'per_item', 3, 20);

    -- ── その他（= 個別見積もりの入口。金額未定で受付可能） ──
    INSERT INTO public.repair_items (store_id, garment_type_id, code, name, icon, base_price, price_unit, lead_time_days, requires_quote, sort_order)
    VALUES (s.id, g_other, 'other', '特殊対応・その他（個別見積もり）', '📝', 0, 'per_item', 7, true, 10);

  END LOOP;
END $seed$;
