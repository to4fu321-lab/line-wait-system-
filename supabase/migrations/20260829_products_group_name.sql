-- ============================================================
-- 糸（ストリング）などのバリアント商品を2段選択できるようにする
--
--   ガットは「銘柄 × 色（× ゲージ）」でSKUが分かれる。1銘柄4色なら
--   30銘柄で120行になり、受付のセレクトを1段で出すと選べない。
--   group_name（＝銘柄）でまとめて〈銘柄を選ぶ → 色を選ぶ〉の2段にする。
--
--   専用の材料マスタは作らない。ストリングは張替えなしの単品販売もする
--   POS商品なので、products に置かないと在庫・原価・売上が二重になる。
--   設計: docs/repair-flexible-catalog-design.md §3 追加③
--
--   products はテーブル単位GRANT方式（stores のようなカラム単位ではない）
--   ため、列の追加だけでクライアントから読み書きできる。
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS group_name text;

COMMENT ON COLUMN public.products.group_name IS
  'バリアントのまとめ名（例: BG66アルティマックス）。受付/POSで〈銘柄→色〉の2段選択に使う。null=単独商品';

-- 受付で category（'string' 等）＋ group_name を引く用
CREATE INDEX IF NOT EXISTS idx_products_store_category_group
  ON public.products (store_id, category, group_name)
  WHERE active;

NOTIFY pgrst, 'reload schema';
