-- active_fittings（試着室の実数）の書き込みGRANTが欠けていた
--
-- lib/[storeId]/admin/shifts/_lib/demand.ts の人員計算や、
-- お客様LINEの混雑表示・順番待ちAPIはこの列を読んでいたが、
-- authenticated への UPDATE GRANT が無く、スタッフ側から
-- 設定するUIも無かったため、全店舗が列のデフォルト値(1)のまま
-- 固定されていた。RLS(stores_staff_update)は既に整っているので、
-- GRANTを足すだけで、店舗スタッフによる更新が可能になる。

GRANT UPDATE (active_fittings) ON public.stores TO authenticated;
