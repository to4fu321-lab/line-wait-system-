import type { RepairType } from '@/types/crm'
import type { InquiryType, InquiryStatus } from '../../_components/InquiryModal'

export const REPAIR_TYPES_DEF: Array<{ type: RepairType; label: string; icon: string; color: string }> = [
  { type: 'hem',          label: '裾上げ',    icon: '✂️', color: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { type: 'sleeve',       label: '袖丈直し',  icon: '👔', color: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { type: 'waist',        label: 'ウエスト',  icon: '📏', color: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { type: 'embroidery',   label: '刺繍',      icon: '🔤', color: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100' },
  { type: 'button',       label: 'ボタン',    icon: '🔘', color: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100' },
  { type: 'tear',         label: '修理・補修', icon: '🩹', color: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' },
  { type: 'badge',        label: '校章付け',  icon: '🏅', color: 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { type: 'size_exchange',label: 'サイズ交換', icon: '↕️', color: 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { type: 'other',        label: 'その他',    icon: '📝', color: 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

// DBなし時のフォールバック
export const DEFAULT_REPAIR_CATS = [
  { name: '上着・ジャケット', icon: '🧥' },
  { name: 'スラックス',       icon: '👖' },
  { name: 'スカート',         icon: '👗' },
  { name: 'ワイシャツ',       icon: '👔' },
] as const

// カラーパレット（アイコン背景用）
export const CAT_ICON_COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
]

export const INQ_TYPE_LABELS: Record<InquiryType, string> = { inquiry:'問合せ', complaint:'クレーム', request:'要望', other:'その他' }
export const INQ_TYPE_BADGE: Record<InquiryType, string> = {
  inquiry:'bg-blue-100 text-blue-700 border border-blue-200',
  complaint:'bg-red-100 text-red-700 border border-red-200',
  request:'bg-purple-100 text-purple-700 border border-purple-200',
  other:'bg-gray-100 text-gray-500 border border-gray-200',
}
export const INQ_TYPE_BORDER: Record<InquiryType, string> = { inquiry:'border-l-blue-400', complaint:'border-l-red-500', request:'border-l-purple-400', other:'border-l-gray-300' }
export const INQ_STATUS_LABELS: Record<InquiryStatus, string> = { pending:'未対応', in_progress:'対応中', completed:'完了' }
export const INQ_STATUS_BADGE: Record<InquiryStatus, string> = { pending:'bg-red-100 text-red-700', in_progress:'bg-amber-100 text-amber-700', completed:'bg-green-100 text-green-700' }
export const INQ_METHOD_LABELS: Record<string, string> = { line:'LINE', phone:'電話', in_store:'店頭', email:'メール' }
