-- ============================================================
-- マニュアル OCR 一括取込機能 Phase 1
-- schools テーブルに学校単位の自由テキスト列を追加
--   設計: docs/superpowers/specs/2026-06-15-manual-ocr-import-design.md
-- ============================================================

ALTER TABLE schools ADD COLUMN IF NOT EXISTS wearing_regulations text; -- 着用規定
ALTER TABLE schools ADD COLUMN IF NOT EXISTS special_notes       text; -- 特記事項
ALTER TABLE schools ADD COLUMN IF NOT EXISTS schedule_notes      text; -- 販売スケジュール・締切
ALTER TABLE schools ADD COLUMN IF NOT EXISTS extra_info          text; -- その他情報
