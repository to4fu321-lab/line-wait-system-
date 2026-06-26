// ============================================================
// 「今日やること」統合タスクモデル
//   5つの業務ソース（お直し/発注/入荷/お渡し/問合せ）を、
//   現場スタッフ向けの「誰に・何をするか」に正規化する。
//   ※ kind（案件種別）は内部用。画面には絶対に出さない。
// ============================================================
import type { RepairRow, PurchaseRow, UniformOrderRow, DeliveryItem } from '../../repairs/_components/types'
import type { InquiryRow } from '../../_components/InquiryModal'

export type TaskKind =
  | 'inquiry'
  | 'repair_start'
  | 'repair_complete'
  | 'repair_other'
  | 'purchase_order'
  | 'uniform_order'
  | 'arrival'
  | 'delivery'

export type Bucket = 'now' | 'today' | 'week'

export type TaskSource =
  | { type: 'repair'; row: RepairRow }
  | { type: 'purchase'; row: PurchaseRow }
  | { type: 'uniform'; row: UniformOrderRow }
  | { type: 'delivery'; row: DeliveryItem }
  | { type: 'inquiry'; row: InquiryRow }

export interface Task {
  id: string            // `${kind}:${rowId}` 一意
  rowId: string
  kind: TaskKind        // 内部のみ
  name: string          // 子ども名 → 顧客名 → '（お客様）'
  schoolName: string | null
  itemLabel: string     // 短い内容/品名
  actionLabel: string   // ボタンの動詞
  bucket: Bucket
  deadlineLabel: string | null
  sortKey: number       // バケット内の並び（小さいほど緊急）
  source: TaskSource
}

// ── 日付ユーティリティ（page.tsx と同じ「ローカル0時」基準）──
function todayMidnight(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d
}
export function dayDiff(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr); if (isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return Math.floor((d.getTime() - todayMidnight().getTime()) / 86400000)
}
// 経過日数（ready_date からの滞留）
export function ageDays(dateStr: string | null): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr); if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

// 締切（未来日）からバケット＋ラベル＋スコアを決定
export function bucketFromDeadline(deadline: string | null, fallback: Bucket): {
  bucket: Bucket; label: string | null; sortKey: number
} {
  const diff = dayDiff(deadline)
  if (diff === null) return { bucket: fallback, label: null, sortKey: 500 }
  if (diff < 0)  return { bucket: 'now',   label: `${-diff}日超過`, sortKey: diff - 1000 }
  if (diff === 0) return { bucket: 'today', label: '今日まで',      sortKey: -100 }
  if (diff === 1) return { bucket: 'today', label: '明日まで',      sortKey: -50 }
  if (diff <= 7) return { bucket: 'week',  label: `あと${diff}日`,  sortKey: diff }
  return { bucket: 'week', label: null, sortKey: diff }
}

// due_date に時刻がある場合のみ「あと◯時間」
export function hoursLabel(dateStr: string | null): string | null {
  if (!dateStr) return null
  // 日付のみ(YYYY-MM-DD)なら時刻なし扱い
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return null
  const d = new Date(dateStr); if (isNaN(d.getTime())) return null
  const diffH = Math.round((d.getTime() - Date.now()) / 3600000)
  if (diffH <= 0) return '対応期限超過'
  if (diffH <= 24) return `あと${diffH}時間`
  return null
}

export const BUCKET_META: Record<Bucket, { label: string; emoji: string; accent: string }> = {
  now:   { label: '今すぐ',  emoji: '🔴', accent: 'text-red-600' },
  today: { label: '今日中',  emoji: '🟡', accent: 'text-amber-600' },
  week:  { label: '今週',    emoji: '🟢', accent: 'text-emerald-600' },
}
