-- ============================================================
-- 学生服店テナントの初期抽出項目（extraction_schemas 初期データ）
--   対象: 開発DB(line-wait-system-dev) の「デモ学生服店」
--         store_id = de51a000-0000-0000-0000-000000000001
--   ※ 本番DBへ流す場合は、本番の該当店舗の stores.id に置き換えること。
--
--   項目: 品目(product/text/必須) サイズ(size/text) 補正内容(adjustment/text)
--         金額(price/number/必須)
--
--   冪等: (store_id, field_key) UNIQUE により ON CONFLICT で再実行安全。
-- ============================================================

INSERT INTO public.extraction_schemas
  (store_id, field_key, field_label, field_type, description, sort_order, is_required)
VALUES
  ('de51a000-0000-0000-0000-000000000001', 'product',    '品目',   'text',   '商品名・品目（例: 男子スラックス, ブレザー, 詰め襟上着）', 1, true),
  ('de51a000-0000-0000-0000-000000000001', 'size',       'サイズ', 'text',   'サイズ表記（例: 165A, M, 150）',                          2, false),
  ('de51a000-0000-0000-0000-000000000001', 'adjustment', '補正内容','text',   '裾上げ・ウエスト詰めなどの補正内容',                       3, false),
  ('de51a000-0000-0000-0000-000000000001', 'price',      '金額',   'number', '金額（円・数値のみ）',                                    4, true)
ON CONFLICT (store_id, field_key) DO UPDATE
  SET field_label = EXCLUDED.field_label,
      field_type  = EXCLUDED.field_type,
      description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order,
      is_required = EXCLUDED.is_required;
