-- ============================================================
-- お直し商材の汎用化 Phase 1
--   1. stores.repair_settings … 業種プロファイル（語彙・挙動）
--   2. repair_items.fields    … MeasurementDef を一般化した入力定義
--   3. repair_options.fields  … オプション側にも同じ入力定義を持たせる
--   4. repair_histories.received_by / strung_by … 受付者・施工者
--
--   設計: docs/repair-flexible-catalog-design.md
--   冪等: 再実行安全。既存の制服店は profile 未設定=uniform 扱いで無影響。
-- ============================================================

-- ── 1. 業種プロファイル ──────────────────────────────────────
--   { profile, labels:{...}, material_enabled, intake_photo_required }
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS repair_settings jsonb;

COMMENT ON COLUMN public.stores.repair_settings IS
  'お直し業種プロファイル { profile: uniform|racket|custom, labels: {domain,garment,item,option,measurement,unit_count}, material_enabled: bool, intake_photo_required: bool }。null=uniform既定';

-- stores はカラム単位GRANT方式のため、クライアントから読み書きする列は
-- 必ず GRANT を同じマイグレーションに書く（20260712_stores_ui_settings.sql と同パターン）
GRANT SELECT (repair_settings) ON public.stores TO anon, authenticated;
GRANT UPDATE (repair_settings) ON public.stores TO authenticated;

-- ── 2. 入力定義の一般化（measurements → fields） ─────────────
--   measurements は互換のため残し、fields を新設して両読みする。
--   FieldDef: { key, label, type?, unit?, required?, default?, min?, max?, step?, choices?, material_category?, affects_price? }
--   type 未指定は 'text'（= 従来の measurements と同じ挙動）
ALTER TABLE public.repair_items
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.repair_options
  ADD COLUMN IF NOT EXISTS fields jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.repair_items.fields IS
  '受付時に聞く入力定義 [{key,label,type,unit,required,default,min,max,step,choices}]。空配列なら measurements にフォールバック';
COMMENT ON COLUMN public.repair_options.fields IS
  'オプション選択時に追加で聞く入力定義。書式は repair_items.fields と同じ';

-- 既存の measurements を fields へ引き上げる（type は 'text' 相当のまま）
--   mm 単位のものだけ number として扱えるよう type を付与する
UPDATE public.repair_items
SET fields = (
  SELECT jsonb_agg(
    CASE
      WHEN m->>'unit' IN ('mm','cm','度','℃') THEN m || jsonb_build_object('type','number')
      ELSE m || jsonb_build_object('type','text')
    END
  )
  FROM jsonb_array_elements(measurements) AS m
)
WHERE jsonb_array_length(COALESCE(fields, '[]'::jsonb)) = 0
  AND jsonb_array_length(COALESCE(measurements, '[]'::jsonb)) > 0;

-- ── 3. 受付者・施工者 ────────────────────────────────────────
--   紙伝票の「受付」「張」欄に相当。受付した人と実際に作業した人は別。
ALTER TABLE public.repair_histories
  ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS strung_by   uuid REFERENCES public.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.repair_histories.received_by IS '受付担当スタッフ';
COMMENT ON COLUMN public.repair_histories.strung_by   IS '施工担当スタッフ（内製時。外注は vendor_id）';

CREATE INDEX IF NOT EXISTS idx_repair_histories_strung_by
  ON public.repair_histories (strung_by) WHERE strung_by IS NOT NULL;

NOTIFY pgrst, 'reload schema';
