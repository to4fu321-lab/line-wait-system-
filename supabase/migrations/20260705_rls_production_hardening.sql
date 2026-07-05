-- ============================================================
-- RLS 本番セキュリティ再構築 (2026-07-05)
--
-- 背景:
--   開発時の「anon 全許可 (USING true)」ポリシーが本番にもそのまま
--   適用されており、anon キー保持者(=全員)が全テーブルを
--   SELECT/INSERT/UPDATE/DELETE できる状態だった。
--
-- 本マイグレーションの方針:
--   1. stores.pin / features.owner_pin を bcrypt ハッシュ化
--      (照合は SECURITY DEFINER 関数 verify_store_pin で行う)
--   2. public スキーマの全ポリシーを一旦 DROP し、カテゴリ別に再作成
--      - anon        : 公開マスタの SELECT のみ
--      - authenticated: スタッフセッション(JWT app_metadata.store_id)で
--                       自店舗の行のみ ALL
--      - 顧客導線の読み書きは全てサーバーAPI (service_role) 経由
--   3. stores のテーブル/カラム GRANT を正規化
--   4. 採番RPCの anon EXECUTE を剥奪
--
-- 冪等: 再実行しても安全なように書いてある。
-- dev/本番のスキーマ差異: to_regclass ガードで存在テーブルのみ処理。
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ────────────────────────────────────────────────────────────
-- 1. PIN のハッシュ化
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS owner_pin_hash text;

-- features.owner_pin → owner_pin_hash へ移送(平文キーは削除)
UPDATE public.stores
SET owner_pin_hash = extensions.crypt(features->>'owner_pin', extensions.gen_salt('bf'))
WHERE features ? 'owner_pin'
  AND COALESCE(features->>'owner_pin', '') <> '';

UPDATE public.stores
SET features = features - 'owner_pin'
WHERE features ? 'owner_pin';

-- stores.pin を bcrypt 化($2 で始まる=ハッシュ済みはスキップ)
UPDATE public.stores
SET pin = extensions.crypt(pin, extensions.gen_salt('bf'))
WHERE pin IS NOT NULL AND pin <> '' AND pin NOT LIKE '$2%';

-- PIN 照合(service_role 専用: API ルートからのみ呼ぶ)
CREATE OR REPLACE FUNCTION public.verify_store_pin(p_store_id uuid, p_pin text)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE s record;
BEGIN
  IF p_pin IS NULL OR length(p_pin) < 4 THEN RETURN NULL; END IF;
  SELECT pin, owner_pin_hash INTO s FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF s.owner_pin_hash IS NOT NULL AND s.owner_pin_hash <> ''
     AND s.owner_pin_hash = extensions.crypt(p_pin, s.owner_pin_hash) THEN
    RETURN 'owner';
  END IF;
  IF s.pin IS NOT NULL AND s.pin <> ''
     AND s.pin = extensions.crypt(p_pin, s.pin) THEN
    RETURN 'staff';
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.verify_store_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_store_pin(uuid, text) TO service_role;

-- PIN 保存用ハッシュ関数(service_role 専用)
CREATE OR REPLACE FUNCTION public.hash_pin(p_pin text)
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = extensions
AS $$ SELECT extensions.crypt(p_pin, extensions.gen_salt('bf')) $$;

REVOKE ALL ON FUNCTION public.hash_pin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_pin(text) TO service_role;

-- ────────────────────────────────────────────────────────────
-- 2. スタッフ判定ヘルパー(JWT app_metadata.store_id)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.jwt_store_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'store_id', ''),
    ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of(sid uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT auth.role() = 'authenticated' AND public.jwt_store_id() = sid
$$;

-- store_id が text 型のテーブル(環境差異)向けオーバーロード
CREATE OR REPLACE FUNCTION public.is_staff_of(sid text)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT auth.role() = 'authenticated'
     AND public.jwt_store_id() IS NOT NULL
     AND public.jwt_store_id()::text = sid
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT auth.role() = 'authenticated' AND public.jwt_store_id() IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.jwt_store_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_of(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff_of(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 3. 既存ポリシーの全削除
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname
           FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- 4. カテゴリ別ポリシー再作成
-- ────────────────────────────────────────────────────────────

-- 4-a. 公開マスタ(store_id あり): anon SELECT + 自店舗スタッフ ALL
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'prices', 'price_bands',
    'size_sets', 'size_presets', 'processing_options',
    'repair_items', 'repair_options', 'repair_garment_types',
    'schools', 'school_parent_tips', 'school_requirements',
    'reservation_settings', 'reservation_date_overrides',
    'menus', 'menu_categories'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
      t || '_anon_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_auth_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_staff_of(store_id))',
      t || '_staff_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_staff_of(store_id)) WITH CHECK (public.is_staff_of(store_id))',
      t || '_staff_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_staff_of(store_id))',
      t || '_staff_delete', t);
  END LOOP;
END $$;

-- 4-b. 公開マスタ(store_id なし): anon SELECT + スタッフ ALL
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_grades', 'size_set_items'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
      t || '_anon_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
      t || '_staff_all', t);
  END LOOP;
END $$;

-- 4-c. stores: anon/スタッフ SELECT(カラムGRANTで pin 系は遮断)
--            + 自店舗スタッフ UPDATE(カラムGRANTで6列に制限)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY stores_anon_select ON public.stores FOR SELECT TO anon USING (true)';
  EXECUTE 'CREATE POLICY stores_auth_select ON public.stores FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY stores_staff_update ON public.stores FOR UPDATE TO authenticated USING (public.is_staff_of(id)) WITH CHECK (public.is_staff_of(id))';
END $$;

-- 4-d. スタッフ専用(store_id スコープ): anon 一切不可
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'queues', 'customers', 'children', 'measurements',
    'reservations', 'takeout_orders', 'purchase_orders',
    'feedback', 'inquiries',
    'sales', 'sale_items', 'register_sessions', 'register_cash_movements',
    'staff', 'staff_line_accounts',
    'shifts', 'shift_templates', 'shift_requests', 'shift_swaps',
    'shift_messages', 'shift_budgets', 'leave_requests', 'time_records',
    'staffing_requirements', 'staffing_settings',
    'repair_histories', 'repair_photos', 'repair_vendors', 'suppliers',
    'scan_inbox', 'kantan_tasks', 'uniform_orders', 'uniform_order_items',
    'message_templates', 'customer_tags', 'notification_logs',
    'push_subscriptions', 'kitchen_stations', 'coupons'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff_of(store_id)) WITH CHECK (public.is_staff_of(store_id))',
      t || '_staff_all', t);
  END LOOP;
END $$;

-- 4-e. takeout_order_items: 親注文の store_id で判定
DO $$
BEGIN
  IF to_regclass('public.takeout_order_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.takeout_order_items ENABLE ROW LEVEL SECURITY';
    EXECUTE $p$
      CREATE POLICY takeout_order_items_staff_all ON public.takeout_order_items
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.takeout_orders o
        WHERE o.id = takeout_order_items.order_id AND public.is_staff_of(o.store_id)))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.takeout_orders o
        WHERE o.id = takeout_order_items.order_id AND public.is_staff_of(o.store_id)))
    $p$;
  END IF;
END $$;

-- 4-f. 店舗横断(シフトヘルプ): 何れかの店舗スタッフなら可
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shift_help_offers', 'shift_help_requests'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())',
      t || '_staff_all', t);
  END LOOP;
END $$;

-- 4-g. groups: スタッフの SELECT のみ(書き込みは service_role 専用)
DO $$
BEGIN
  IF to_regclass('public.groups') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY groups_staff_select ON public.groups FOR SELECT TO authenticated USING (public.is_staff())';
  END IF;
END $$;

-- 4-h. ocr_jobs: ポリシー無し(service_role のみ)を維持
DO $$
BEGIN
  IF to_regclass('public.ocr_jobs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. stores の GRANT 正規化(pin / owner_pin_hash はクライアント不可視)
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE sel_cols text; upd_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO sel_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'stores'
    AND column_name NOT IN ('pin', 'owner_pin_hash');

  SELECT string_agg(quote_ident(column_name), ', ') INTO upd_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'stores'
    AND column_name IN ('school_names', 'timecard_settings', 'staff_link_code',
                        'takeout_settings', 'allow_remote', 'business_hours');

  EXECUTE 'REVOKE ALL PRIVILEGES ON public.stores FROM anon, authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.stores TO anon, authenticated', sel_cols);
  IF upd_cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.stores TO authenticated', upd_cols);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. 採番 RPC: anon の実行権を剥奪(顧客フローはサーバーAPI経由)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regprocedure('public.get_next_ticket_number(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_next_ticket_number(uuid) FROM anon';
  END IF;
  IF to_regprocedure('public.get_next_order_number(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_next_order_number(uuid) FROM anon';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
