-- ============================================================
-- インデックス最適化
--
--   Supabase Advisor（performance）の指摘のうち、実際にアプリの
--   ホットパスに当たる箇所だけを対応する。
--   （未インデックスFKは38件検出されたが、大半は現状トラフィックが
--    薄く優先度が低い。ここでは頻繁に絞り込みに使われている列だけ
--    を対象にする。全件一律の追加は書き込みコストが増えるだけで
--    見合わない）
--
--   冪等: 再実行安全。
-- ============================================================

-- ── 1. 重複インデックスの解消 ──────────────────────────────────
--    push_subscriptions.store_id に全く同じ定義のインデックスが2本
--    存在していた（過去のマイグレーションが命名を変えて2重に作成）。
--    書き込みのたびに2本とも更新されるだけで意味がないので1本に統一。
DROP INDEX IF EXISTS public.idx_push_subs_store_id;
-- push_subscriptions_store_id_idx は残す

-- ── 2. マスタ系の外部キー ──────────────────────────────────────
--    /api/master/catalog・/api/master/crud が school_id / product_id で
--    絞り込む。特に products は学校ごとの商品一覧表示で毎回引かれる。
CREATE INDEX IF NOT EXISTS idx_products_school_id
  ON public.products (school_id) WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prices_product_id
  ON public.prices (product_id);

CREATE INDEX IF NOT EXISTS idx_school_requirements_product_id
  ON public.school_requirements (product_id);

-- ── 3. 顧客系の外部キー ────────────────────────────────────────
--    /api/mypage・/api/ec/order・/api/customer/session が customer_id で
--    children / purchase_orders / repair_histories を毎回引く。
CREATE INDEX IF NOT EXISTS idx_children_customer_id
  ON public.children (customer_id);

CREATE INDEX IF NOT EXISTS idx_customers_school_id
  ON public.customers (school_id) WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_customer_id
  ON public.purchase_orders (customer_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_child_id
  ON public.purchase_orders (child_id) WHERE child_id IS NOT NULL;

-- ── 4. 順番待ち・予約の外部キー ────────────────────────────────
--    待合画面・予約画面が customer_id / child_id で頻繁に絞り込む。
CREATE INDEX IF NOT EXISTS idx_queues_customer_id
  ON public.queues (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_queues_child_id
  ON public.queues (child_id) WHERE child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_customer_id
  ON public.reservations (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_child_id
  ON public.reservations (child_id) WHERE child_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
