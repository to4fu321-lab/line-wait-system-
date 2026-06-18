// ── プラン / 機能フラグ定義 ────────────────────────────────────
// stores.features (jsonb) に保存される。
// features._plan でプリセット選択 → 個別フラグで上書き可能。
// デフォルト（何も設定なし）= フル機能を想定。

export type Plan = 'intro' | 'kantan' | 'simple' | 'standard' | 'full'

export type FeatureKey =
  // ── ボトムナビタブ ─────────────────────
  | 'tab_queue'             // 受付タブ
  | 'tab_repairs'           // 案件タブ
  | 'tab_inquiries'         // 問合せタブ
  | 'tab_crm'               // 顧客タブ
  // ── 案件ページ内タブ ───────────────────
  | 'repairs_tab_purchase'  // 発注サブタブ
  | 'repairs_tab_arrival'   // 入荷待ちサブタブ
  | 'repairs_tab_delivery'  // お渡しサブタブ
  // ── 案件ページ機能 ─────────────────────
  | 'repairs_ocr'           // 伝票OCR読み取りボタン
  | 'repairs_master'        // 料金マスタページへのアクセス
  | 'repairs_dummy'         // テストデータ生成ボタン
  // ── かんたんLINEモード ─────────────────
  | 'kantan_line'           // LINE返信でタスク完了する運用
  | 'tray_scan'             // 置くだけスキャン（自動撮影・自動振り分け）
  // ── 学校規定・採寸連携 ──────────────────
  | 'school_master'        // 学校マスター管理
  | 'school_ocr'           // 学校規定OCR取込
  | 'school_crm_card'      // CRM学校規定カード
  | 'school_measurement'   // 採寸パネル（アイテム別）
  | 'school_waiting'       // 顧客待機サイネージ
  | 'line_parent_info'     // LINE保護者情報投稿
  | 'line_coupon'          // クーポン自動配布
  | 'line_parent_rsv'      // LINE採寸予約（保護者）
  | 'customer_self_intake' // お客様セルフ依頼入力（登録後に自分のスマホで依頼内容を入力）
  | 'customer_self_order'  // お客様セルフ制服注文（採寸完了・予約後に自分のスマホで制服を注文）
  // ── 既存フラグ（後方互換）──────────────
  | 'queue'
  | 'crm'
  | 'repairs'
  | 'reservation'
  | 'orders'
  | 'products'
  | 'purchase_orders'
  | 'takeout'
  // ── 通知アドオン（既定OFF・契約時のみON）──
  | 'sms_notify'           // SMS完了通知（未契約時は電話連絡ステップに切替）
  // ── UI（β・既定OFF）──
  | 'today_tasks_ui'       // 「今日やること」スタッフ向けトップ画面

// ── プラン定義 ─────────────────────────────────────────────────
export const PLAN_DEFS: Record<Plan, {
  label: string
  desc: string
  emoji: string
  tailwind: string // bg + border + text
  features: Partial<Record<FeatureKey, boolean>>
}> = {
  intro: {
    label: '導入サンプル',
    desc: 'LINE友達登録・連携・完了通知のみ',
    emoji: '🌱',
    tailwind: 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300',
    features: {
      tab_queue:             false,
      tab_repairs:           false,
      tab_inquiries:         false,
      tab_crm:               false,
      repairs_tab_purchase:  false,
      repairs_tab_arrival:   false,
      repairs_tab_delivery:  false,
      repairs_ocr:           false,
      repairs_master:        false,
      repairs_dummy:         false,
      queue:                 false,
      crm:                   false,
      repairs:               false,
      reservation:           false,
      orders:                false,
      products:              false,
      purchase_orders:       false,
      kantan_line:           false,
      tray_scan:             false,
      school_master:        false,
      school_ocr:           false,
      school_crm_card:      false,
      school_measurement:   false,
      school_waiting:       false,
      line_parent_info:     false,
      line_coupon:          false,
      line_parent_rsv:      false,
    },
  },
  kantan: {
    label: 'かんたんLINE',
    desc: '置くだけスキャン＋LINE返信だけで運用',
    emoji: '🍀',
    tailwind: 'bg-teal-900/40 border-teal-500/40 text-teal-300',
    features: {
      tab_queue:             false,
      tab_repairs:           true,
      tab_inquiries:         false,
      tab_crm:               false,
      repairs_tab_purchase:  false,
      repairs_tab_arrival:   false,
      repairs_tab_delivery:  true,
      repairs_ocr:           false,
      repairs_master:        false,
      repairs_dummy:         false,
      queue:                 false,
      crm:                   true,
      repairs:               true,
      reservation:           false,
      orders:                false,
      products:              false,
      purchase_orders:       true,
      kantan_line:           true,
      tray_scan:             true,
      school_master:        false,
      school_ocr:           false,
      school_crm_card:      false,
      school_measurement:   false,
      school_waiting:       false,
      line_parent_info:     false,
      line_coupon:          false,
      line_parent_rsv:      false,
    },
  },
  simple: {
    label: 'シンプル',
    desc: 'お直し受付・完了通知・お渡し管理',
    emoji: '✂️',
    tailwind: 'bg-blue-900/40 border-blue-500/40 text-blue-300',
    features: {
      tab_queue:             false,
      tab_repairs:           true,
      tab_inquiries:         false,
      tab_crm:               true,
      repairs_tab_purchase:  false,
      repairs_tab_arrival:   false,
      repairs_tab_delivery:  true,
      repairs_ocr:           false,
      repairs_master:        true,
      repairs_dummy:         false,
      queue:                 false,
      crm:                   true,
      repairs:               true,
      reservation:           false,
      orders:                false,
      products:              false,
      purchase_orders:       false,
      kantan_line:           false,
      tray_scan:             false,
      school_master:        false,
      school_ocr:           false,
      school_crm_card:      false,
      school_measurement:   false,
      school_waiting:       false,
      line_parent_info:     false,
      line_coupon:          false,
      line_parent_rsv:      false,
    },
  },
  standard: {
    label: 'スタンダード',
    desc: 'お直し・発注・入荷待ち・料金マスタ',
    emoji: '📦',
    tailwind: 'bg-indigo-900/40 border-indigo-500/40 text-indigo-300',
    features: {
      tab_queue:             true,
      tab_repairs:           true,
      tab_inquiries:         true,
      tab_crm:               true,
      repairs_tab_purchase:  true,
      repairs_tab_arrival:   true,
      repairs_tab_delivery:  true,
      repairs_ocr:           false,
      repairs_master:        true,
      repairs_dummy:         false,
      queue:                 true,
      crm:                   true,
      repairs:               true,
      reservation:           false,
      orders:                false,
      products:              false,
      purchase_orders:       true,
      kantan_line:           false,
      tray_scan:             false,
      school_master:        true,
      school_ocr:           true,
      school_crm_card:      true,
      school_measurement:   true,
      school_waiting:       false,
      line_parent_info:     false,
      line_coupon:          false,
      line_parent_rsv:      false,
    },
  },
  full: {
    label: 'フル',
    desc: 'OCR・マスタ・CRM・全タブ・全機能',
    emoji: '🚀',
    tailwind: 'bg-violet-900/40 border-violet-500/40 text-violet-300',
    features: {
      tab_queue:             true,
      tab_repairs:           true,
      tab_inquiries:         true,
      tab_crm:               true,
      repairs_tab_purchase:  true,
      repairs_tab_arrival:   true,
      repairs_tab_delivery:  true,
      repairs_ocr:           true,
      repairs_master:        true,
      repairs_dummy:         true,
      queue:                 true,
      crm:                   true,
      repairs:               true,
      reservation:           true,
      orders:                true,
      products:              true,
      purchase_orders:       true,
      kantan_line:           true,
      tray_scan:             true,
      school_master:        true,
      school_ocr:           true,
      school_crm_card:      true,
      school_measurement:   true,
      school_waiting:       true,
      line_parent_info:     true,
      line_coupon:          true,
      line_parent_rsv:      true,
    },
  },
}

/**
 * plan defaults + 個別フラグを合成して、実効フィーチャーを返す。
 * デフォルト（plan なし・フラグなし）= true（有効）。
 */
export function resolveFeature(
  key: FeatureKey,
  rawFeatures: Record<string, unknown>,
): boolean {
  // 個別フラグが明示的に設定されていればそちらを優先
  if (key in rawFeatures && typeof rawFeatures[key] === 'boolean') {
    return rawFeatures[key] as boolean
  }
  // プラン default
  const plan = (rawFeatures._plan as Plan | undefined) ?? 'full'
  const planDef = PLAN_DEFS[plan] ?? PLAN_DEFS.full
  if (key in planDef.features) {
    return planDef.features[key as keyof typeof planDef.features] !== false
  }
  // アドオン機能（契約時のみON）はプラン未定義でも既定OFF
  if (ADDON_DEFAULT_OFF.includes(key)) return false
  // 未定義 = 有効（後方互換）
  return true
}

// 契約時のみ有効化するアドオン/β機能。明示設定が無ければ常にOFF。
const ADDON_DEFAULT_OFF: FeatureKey[] = ['sms_notify', 'today_tasks_ui']
