-- ============================================================
-- 同一商品への複数加工（例: スラックス1本に「裾上げ」＋「ウエスト出し」）
--
--   repair_group_id は「同じ受付セッションで登録した行」を束ねる
--   （物理的に別の商品が混ざっていてもよい＝合算金額・まとめ通知用）。
--   これとは別に、同じ物理的な1点にかける複数の加工だけを束ねる
--   physical_item_id を追加する。同じ物理アイテムの行は、仕上がり
--   希望日を必ず揃える（受付側で強制）ためのキーとして使う。
--
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.repair_histories
  ADD COLUMN IF NOT EXISTS physical_item_id uuid;

CREATE INDEX IF NOT EXISTS idx_repair_histories_physical_item_id
  ON public.repair_histories (physical_item_id)
  WHERE physical_item_id IS NOT NULL;

COMMENT ON COLUMN public.repair_histories.physical_item_id IS
  '同じ物理的な1点（例: スラックス1本）にかける複数加工を束ねるID。repair_group_id（受付セッション単位）より細かい粒度。単独受付はnull';

NOTIFY pgrst, 'reload schema';
