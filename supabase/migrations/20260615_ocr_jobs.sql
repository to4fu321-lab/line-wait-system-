-- ============================================================
-- マニュアル OCR 一括取込機能 Phase 1
-- OCR ジョブ管理テーブル
--   設計: docs/superpowers/specs/2026-06-15-manual-ocr-import-design.md
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text        NOT NULL,
  job_type    text        NOT NULL,            -- 'school_manual' | 'order_slip' | 'repair_slip'
  status      text        NOT NULL DEFAULT 'pending', -- pending | processing | done | error
  input_meta  jsonb,                           -- { files: [{ name, type, size }], page_count }
  progress    jsonb,                           -- { current, total, page_labels: [...] }
  result      jsonb,                           -- 抽出結果（プレビュー用）
  tokens_used integer,                         -- Anthropic API トークン消費量（課金管理用）
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 既存環境向け: progress 列が無い場合に追加
ALTER TABLE ocr_jobs ADD COLUMN IF NOT EXISTS progress jsonb;

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_store ON ocr_jobs (store_id, created_at DESC);
