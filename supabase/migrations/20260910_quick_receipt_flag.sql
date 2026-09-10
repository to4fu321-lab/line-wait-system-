-- ============================================================
-- クイック受付フラグ
--
--   クイック受付（QuickReceiveModal）は「お直し」以外の預かり物にも
--   使われる（ラケット以外の何でも受付）。これまで request_type は
--   常に 'repair' 固定で保存しており、一覧バッジが常に「お直し」と
--   表示されて実態と合わないケースがあった。
--
--   request_type 自体は work_started 等の作業フロー分岐に使われている
--   ため値は変えられない（'repair' 以外にすると未着手/作業中タブの
--   集計や完了フローが崩れる）。表示だけを分けるためのフラグとして
--   quick_receipt を追加する。
--
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.repair_histories
  ADD COLUMN IF NOT EXISTS quick_receipt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.repair_histories.quick_receipt IS
  'クイック受付（最小入力の受付モーダル）経由で登録されたレコードかどうか。一覧バッジの表示切り替え専用（request_typeの作業フロー分岐には使わない）';

NOTIFY pgrst, 'reload schema';
