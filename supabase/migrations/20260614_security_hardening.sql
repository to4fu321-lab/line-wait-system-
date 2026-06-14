-- ============================================================
-- セキュリティ強化 (Supabase Security Advisor 対応)
--   1. RLS無効テーブルを有効化(+全許可ポリシー: 既存アプリ規約に合わせる)
--      - size_set_items
--   2. 互換ビューを security_invoker 化(SECURITY DEFINER 脆弱性の解消)
--      - school_products / school_product_variants / school_items
--   3. 関数の search_path を固定(function_search_path_mutable 解消)
--
--   ※ rls_policy_always_true(全許可ポリシー)は本アプリの基盤設計
--     (anonキー + 全許可)のため本マイグレーションでは変更しない。
--     真のテナント分離RLSは認証基盤の導入を伴う別タスク。
--   ※ お直し系マスタ(repair_*)は別ブランチ
--     (claude/uniform-alterations-master-data-rk5jt2)の担当のため対象外。
-- ============================================================

-- 1. RLS 有効化 + 全許可ポリシー(既存テーブル規約に合わせる) ──────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['size_set_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- 2. 互換ビューを security_invoker 化(呼出元の権限/RLSで評価) ──────
ALTER VIEW public.school_products         SET (security_invoker = true);
ALTER VIEW public.school_product_variants SET (security_invoker = true);
ALTER VIEW public.school_items            SET (security_invoker = true);

-- 3. 関数の search_path を固定 ───────────────────────────────────
ALTER FUNCTION public.assign_repair_request_no()         SET search_path = public, extensions;
ALTER FUNCTION public.check_requirement_school()         SET search_path = public, extensions;
ALTER FUNCTION public.get_next_ticket_number(uuid)       SET search_path = public, extensions;
ALTER FUNCTION public.handle_updated_at()                SET search_path = public, extensions;
ALTER FUNCTION public.set_updated_at()                   SET search_path = public, extensions;
ALTER FUNCTION public.sync_queue_to_customer()           SET search_path = public, extensions;
ALTER FUNCTION public.update_children_updated_at()       SET search_path = public, extensions;
ALTER FUNCTION public.update_measurements_updated_at()   SET search_path = public, extensions;
ALTER FUNCTION public.update_purchase_orders_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_scan_inbox_updated_at()     SET search_path = public, extensions;

NOTIFY pgrst, 'reload schema';
