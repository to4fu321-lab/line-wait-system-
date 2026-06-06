import type { Customer, RepairHistory, PurchaseOrder } from '@/types/crm'

// ============================================================
// 未対応セクション — Repair + Purchase の型
// ============================================================
export type RepairWithCustomer   = RepairHistory   & { customer: Pick<Customer, 'name' | 'tel'> | null; child: { name: string } | null }
export type PurchaseWithCustomer = PurchaseOrder   & { customer: Pick<Customer, 'name' | 'tel'> | null; child: { name: string } | null }

// ============================================================
// 顧客情報インラインパネル用
// ============================================================
export type CustomerInfoData = {
  id: string; name: string; kana: string | null; tel: string | null
  children: { id: string; name: string; school_name: string | null; grade: string | null }[]
}

// ============================================================
// 統合新規依頼受付フォーム — タイプ
// ============================================================
export type IntakeFormType = 'repair' | 'repair_consult' | 'purchase' | 'inquiry'

export const INTAKE_OPTIONS: {
  value: IntakeFormType; label: string
  ph_item: string; ph_content: string
  showContent: boolean; showPrice: boolean; showSlip: boolean; showDate: boolean; showPrepaid: boolean
  isPurchase: boolean
}[] = [
  { value: 'repair',         label: '✂️ お直し',        ph_item: '例：○○高校スラックス',   ph_content: '例：裾上げ5cm',        showContent: true,  showPrice: true,  showSlip: true,  showDate: true,  showPrepaid: true,  isPurchase: false },
  { value: 'repair_consult', label: '🔍 お直し相談',    ph_item: '例：ブレザー',             ph_content: '例：採寸・見積り相談', showContent: true,  showPrice: true,  showSlip: false, showDate: false, showPrepaid: false, isPurchase: false },
  { value: 'purchase',       label: '📦 追加購入・注文', ph_item: '例：○○高校学ラン 165A',  ph_content: '',                     showContent: false, showPrice: true,  showSlip: false, showDate: false, showPrepaid: false, isPurchase: true  },
  { value: 'inquiry',        label: '❓ その他問合せ',   ph_item: '例：問合せ内容の概要',    ph_content: '例：詳細',             showContent: true,  showPrice: false, showSlip: false, showDate: false, showPrepaid: false, isPurchase: false },
]

// ============================================================
// あいうえおインデックス
// ============================================================
export const KANA_ROWS = ['ア','カ','サ','タ','ナ','ハ','マ','ヤ','ラ','ワ','他'] as const
export type KanaRow = typeof KANA_ROWS[number]
