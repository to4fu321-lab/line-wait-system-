-- ============================================================
-- 初期設定ウィザードの回答
--
--   新規店舗が最初に触るのは「マスタ登録」だが、どこから手を付ければ
--   よいか分からない画面だった。業種・外注の有無を先に聞いて、必要な
--   ものだけ出す/取り込むための回答をここに持つ。
--
--   形式:
--     {
--       "trade":      "uniform" | "repair" | "racket" | "other",
--       "use_vendor": true | false,      -- お直しを外注に出すか
--       "done_at":    "2026-09-02T...",  -- 完了時刻。あればウィザードを出さない
--       "skipped":    true               -- 「あとで」を選んだ
--     }
--
--   これは業務設定であってプラン(features)ではない。課金に関わる機能ON/OFFは
--   スーパー管理画面のままにして、ここでは触らない。
--
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS setup jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.stores.setup IS
  '初期設定ウィザードの回答 {trade, use_vendor, done_at, skipped}。プラン(features)とは別物';

-- stores はカラム単位GRANT方式。追加した列は必ずGRANTも書く
-- （書き忘れるとクライアントの SELECT がクエリごと失敗する）
GRANT SELECT (setup) ON public.stores TO anon, authenticated;
GRANT UPDATE (setup) ON public.stores TO authenticated;

NOTIFY pgrst, 'reload schema';
