-- ============================================================
-- 問合せの受付番号(採番)。store_id 単位の連番。お直し(repair_histories)と同方式。
-- ============================================================

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS request_no integer;

CREATE OR REPLACE FUNCTION public.assign_inquiry_request_no()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','extensions' AS $$
BEGIN
  IF NEW.request_no IS NULL THEN
    SELECT COALESCE(MAX(request_no),0)+1 INTO NEW.request_no
    FROM public.inquiries WHERE store_id = NEW.store_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_inquiry_request_no ON public.inquiries;
CREATE TRIGGER trg_inquiry_request_no BEFORE INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.assign_inquiry_request_no();

-- 既存分を作成日順で採番
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY created_at, id) AS rn
  FROM public.inquiries WHERE request_no IS NULL
)
UPDATE public.inquiries i SET request_no = n.rn FROM numbered n WHERE i.id = n.id;
