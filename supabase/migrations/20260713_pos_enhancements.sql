-- ============================================================
-- レジ機能拡張 (2026-07-13)
--   1. sales: 値引き / 領収書宛名・但し書き / 取消情報
--   2. products: 在庫数 (null=在庫管理しない) + 在庫増減RPC
--   3. stores: インボイス登録番号（適格請求書発行事業者番号）
--   4. order_payments: 注文への入金履歴（前受金・内金・残金）
-- 冪等: 再実行安全。
-- ============================================================

-- ── 1. sales 拡張 ─────────────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS discount     integer NOT NULL DEFAULT 0, -- 会計全体の値引き(円・税込)
  ADD COLUMN IF NOT EXISTS receipt_name text,                       -- 領収書 宛名
  ADD COLUMN IF NOT EXISTS receipt_note text,                       -- 領収書 但し書き
  ADD COLUMN IF NOT EXISTS voided_at    timestamptz,                -- 取消日時
  ADD COLUMN IF NOT EXISTS void_reason  text;                       -- 取消理由

-- ── 2. products 在庫 ─────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock integer; -- null=在庫管理しない。マイナス許容(売り越しの可視化)

-- 在庫増減（stock が null の商品は在庫管理対象外なので無視）
CREATE OR REPLACE FUNCTION public.adjust_product_stock(p_product_id uuid, p_delta integer)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.products
  SET stock = stock + p_delta
  WHERE id = p_product_id AND stock IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, integer) TO authenticated, service_role;

-- ── 3. stores インボイス登録番号 ──────────────────────────────
-- stores はカラム単位GRANT方式のため、追加列には必ずGRANTを書く（事故防止規約）
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS invoice_number text;
GRANT SELECT (invoice_number) ON public.stores TO anon, authenticated;
GRANT UPDATE (invoice_number) ON public.stores TO authenticated;

-- ── 4. order_payments（注文入金履歴）─────────────────────────
-- uniform_orders.store_id が text のため store_id は text で合わせる
CREATE TABLE IF NOT EXISTS public.order_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   text NOT NULL,
  order_id   uuid NOT NULL REFERENCES public.uniform_orders(id) ON DELETE CASCADE,
  sale_id    uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  amount     integer NOT NULL,
  method     text,                                -- 支払方法(sales.payment_method と同じ値)
  kind       text NOT NULL DEFAULT 'deposit',     -- deposit(内金) / balance(残金・全額)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON public.order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_store ON public.order_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_sale  ON public.order_payments(sale_id);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_payments_staff_all ON public.order_payments;
CREATE POLICY order_payments_staff_all ON public.order_payments
  FOR ALL TO authenticated
  USING (public.is_staff_of(store_id)) WITH CHECK (public.is_staff_of(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;

-- PostgREST スキーマキャッシュを再読込
NOTIFY pgrst, 'reload schema';
