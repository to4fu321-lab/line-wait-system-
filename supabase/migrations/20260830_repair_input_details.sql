-- ============================================================
-- 受付内容の表示用スナップショット
--
--   これまで一覧カードは content（「ガット張り（無）ポンド数24P 購入後…」）
--   という全部入りの1文字列しか持っておらず、畳んでも情報量が減らなかった。
--   ラベル付きの明細に分けて持たせ、畳んだ時は作業名だけ、開いた時に
--   ラケット・糸・ポンド数…と並べられるようにする。
--
--   ラベルはマスタ(repair_items.fields)側にあるが、一覧の各行から毎回
--   マスタを引くのは無駄なので、受付時にスナップショットする。
--   （selected_options が価格を凍結しているのと同じ考え方。マスタの
--     ラベルを後から変えても、過去の伝票の表示は当時のまま残る）
--
--   形式: [{ "label": "ポンド数", "value": "24P" }, ...]
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.repair_histories
  ADD COLUMN IF NOT EXISTS input_details jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.repair_histories.input_details IS
  '受付時に聞いた入力のラベル付きスナップショット [{label,value}]。一覧の展開表示用。空配列なら content にフォールバック';

NOTIFY pgrst, 'reload schema';
