-- ============================================================
-- Stripeサブスクリプション連携（store_subscriptions）
--
--   店舗ごとに Stripe の顧客/サブスクリプションを1件ずつ紐づける。
--   書き込みは /api/billing/checkout・/api/billing/portal・
--   /api/webhook/stripe（すべて service role）のみが行う。
--   店舗スタッフは自店舗分の閲覧のみ（利用状況ページ表示用）。
--
--   plan 列は決済成功時にこの値を stores.features._plan にも反映する
--   （どのプランに割り当てるかは Stripe Price ID → プランキーの対応を
--   env(STRIPE_PLAN_MAP等)で持つ。lib/stripe.ts 参照）。
--
--   冪等: 再実行安全。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  store_id                uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,
  status                  text NOT NULL DEFAULT 'none',
    -- 'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'unpaid'
  plan                    text,             -- 適用中のプランキー（stores.features._plan と同じ値を持つ）
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_subscriptions_stripe_customer
  ON public.store_subscriptions (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS store_subscriptions_staff_select ON public.store_subscriptions;
CREATE POLICY store_subscriptions_staff_select ON public.store_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_staff_of(store_id));

GRANT SELECT ON public.store_subscriptions TO authenticated;

-- updated_at トリガ(既存の共有関数 set_updated_at を利用。20260621_staff_formalize.sql で作成済み)
DROP TRIGGER IF EXISTS trg_store_subscriptions_updated_at ON public.store_subscriptions;
CREATE TRIGGER trg_store_subscriptions_updated_at BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
