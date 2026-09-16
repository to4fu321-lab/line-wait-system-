-- ============================================================
-- 商品マスタのテナント分離（各店ごとに完全個別の商品情報にする）
--
-- 【これまでの問題】
--   20260614_master_data_rebuild.sql で、商品マスタ一式を
--     GRANT SELECT, INSERT, UPDATE, DELETE ... TO anon, authenticated;
--   としたうえで、RLS は USING (true) WITH CHECK (true)（全許可）だった。
--
--   anon キーは JS バンドルに載る公開キーなので、この状態では
--     - 他店の商品・サイズ・価格・仕入原価をすべて読める
--     - 他店の商品・価格を書き換え・削除できる
--   （store_id 列はあるが、絞るかどうかはアプリ任せ＝実質ラベルでしかない）
--
-- 【この後どうなるか】
--   マスタはブラウザから直接触れなくなる。すべてサーバーAPI経由になり、
--   サーバー側が store_id を固定する。
--     /api/master/catalog   店舗スコープの読み取り（顧客画面も使う。原価は返さない）
--     /api/master/crud      追加・更新・削除と原価つき読み取り（店舗PIN必須）
--     /api/master/directory 学校名→住所・電話の名簿（店舗PIN必須。唯一の越境参照）
--   これらは service_role で動くので、本マイグレーションの影響を受けない。
--
-- 【適用順序】※順番を間違えると画面が壊れます
--   1. アプリ（この変更を含むコード）を先に本番へデプロイする
--   2. デプロイ完了を確認してから、この SQL を実行する
--   ※ 先に SQL を実行すると、旧コードのブラウザから商品が読めなくなります。
--
-- 【切り戻し】
--   問題が出たら末尾のロールバック用 GRANT を実行すれば元に戻せます。
-- ============================================================

-- ── 1. 公開キー(anon)とスタッフセッション(authenticated)から権限を剥奪 ──
--    anon          : 誰でも取得できる公開キー。ここが最大の穴だった。
--    authenticated : 店舗スタッフのセッション。RLS が全許可のままなので、
--                    A店のスタッフが B店のマスタを読める状態だった。
--                    マスタはAPI経由に統一したため、どちらも不要。
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools', 'size_sets', 'size_set_items', 'products',
    'school_requirements', 'prices', 'processing_options'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = t
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    END IF;
  END LOOP;
END $$;

-- 互換ビュー（採寸・EC・受付・お直しが参照する読み取り用）
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['school_products', 'school_product_variants', 'school_items'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = v AND c.relkind = 'v'
    ) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', v);
      EXECUTE format('GRANT SELECT ON public.%I TO service_role;', v);
    END IF;
  END LOOP;
END $$;

-- ── 2. 今後テーブルを追加したときに自動で anon へ開かないようにする ──
--    Supabase の既定権限は public スキーマの新規テーブルを anon にも開く。
--    マスタと同じ穴を繰り返さないよう、既定権限からマスタ系を外しておく。
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- ── 3. RLSポリシーは残すが、権限が無いので anon/authenticated からは到達しない ──
--    （service_role は RLS をバイパスするため、ポリシーの変更は不要）
--    将来 authenticated に開き直す場合は、USING (true) ではなく
--    store_id = auth.jwt() -> 'app_metadata' ->> 'store_id' で必ず絞ること。

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- ロールバック（緊急時のみ。実行すると他店からの読み書きが再び可能になります）
-- ------------------------------------------------------------
-- GRANT SELECT, INSERT, UPDATE, DELETE ON
--   size_sets, size_set_items, products, school_requirements, prices,
--   processing_options, schools
--   TO anon, authenticated;
-- GRANT SELECT ON
--   school_products, school_product_variants, school_items
--   TO anon, authenticated;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================
