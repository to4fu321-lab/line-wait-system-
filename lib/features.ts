// ── プラン / 機能フラグ定義 ────────────────────────────────────
// stores.features (jsonb) に保存される。
// features._plan でプリセット選択 → 個別フラグで上書き可能。
// デフォルト（何も設定なし）= フル機能を想定。

// 現行プランID（旧プランIDは legacy エイリアスで後方互換維持）
export type Plan =
  | 'free_trial'    // 無料体験
  | 'test'          // テスト用
  | 'repairs_focus' // お直し特化
  | 'simple'        // かんたん特化
  | 'standard'      // スタンダード
  | 'full'          // フル
  | 'intro'         // legacy → free_trial 扱い
  | 'kantan'        // legacy → simple 扱い

export type FeatureKey =
  // ── ボトムナビタブ ─────────────────────
  | 'tab_queue'             // 受付タブ
  | 'tab_repairs'           // お仕事タブ
  | 'tab_inquiries'         // 問合せタブ
  | 'tab_crm'               // 顧客タブ
  // ── お仕事ページ内タブ ─────────────────
  | 'repairs_tab_purchase'  // 発注サブタブ
  | 'repairs_tab_arrival'   // 入荷待ちサブタブ
  | 'repairs_tab_delivery'  // お渡しサブタブ
  // ── お仕事ページ機能 ───────────────────
  | 'repairs_ocr'           // 伝票OCR読み取りボタン
  | 'repairs_master'        // 料金マスタページへのアクセス
  | 'repairs_dummy'         // テストデータ生成ボタン
  // ── かんたんLINEモード ─────────────────
  | 'kantan_line'           // LINE返信でタスク完了する運用
  | 'tray_scan'             // 置くだけスキャン
  // ── 学校規定・採寸連携 ──────────────────
  | 'school_master'
  | 'school_ocr'
  | 'school_crm_card'
  | 'school_measurement'
  | 'school_waiting'
  | 'line_parent_info'
  | 'line_coupon'
  | 'line_parent_rsv'
  | 'customer_self_intake'
  | 'customer_self_order'
  // ── 既存フラグ（後方互換）──────────────
  | 'queue'
  | 'crm'
  | 'repairs'
  | 'reservation'
  | 'orders'
  | 'products'
  | 'purchase_orders'
  | 'takeout'
  // ── 通知アドオン ───────────────────────
  | 'sms_notify'
  | 'followup_notify'
  // ── UI β ──────────────────────────────
  | 'today_tasks_ui'
  // ── レジ ──────────────────────────────
  | 'pos'
  // ── シフト管理 ─────────────────────────
  | 'shift_management'
  | 'shift_inter_store'
  | 'shift_attendance'
  | 'shift_leave'
  | 'shift_swap'
  | 'staff_push'
  | 'shift_demand'
  | 'shift_dashboard'
  | 'shift_ai'

// ── 全OFF ベースライン（プラン定義に使う）────────────────────────
const ALL_OFF: Partial<Record<FeatureKey, boolean>> = {
  tab_queue: false, tab_repairs: false, tab_inquiries: false, tab_crm: false,
  repairs_tab_purchase: false, repairs_tab_arrival: false, repairs_tab_delivery: false,
  repairs_ocr: false, repairs_master: false, repairs_dummy: false,
  kantan_line: false, tray_scan: false,
  school_master: false, school_ocr: false, school_crm_card: false,
  school_measurement: false, school_waiting: false,
  line_parent_info: false, line_coupon: false, line_parent_rsv: false,
  customer_self_intake: false, customer_self_order: false,
  queue: false, crm: false, repairs: false, reservation: false,
  orders: false, products: false, purchase_orders: false,
  takeout: false, sms_notify: false, followup_notify: false,
  today_tasks_ui: false, pos: false,
  shift_management: false, shift_inter_store: false, shift_attendance: false,
  shift_leave: false, shift_swap: false, staff_push: false,
  shift_demand: false, shift_dashboard: false, shift_ai: false,
}

// ── プラン定義 ─────────────────────────────────────────────────
export const PLAN_DEFS: Record<Plan, {
  label: string
  desc: string
  emoji: string
  tailwind: string
  hidden?: boolean  // legacy プランはUI非表示
  features: Partial<Record<FeatureKey, boolean>>
}> = {

  // ── 無料体験 ──────────────────────────────────────────────────
  free_trial: {
    label: '無料体験',
    desc: '受付・順番待ちのみ。30日間お試し',
    emoji: '🌱',
    tailwind: 'bg-emerald-900/40 border-emerald-500/40 text-emerald-300',
    features: {
      ...ALL_OFF,
      tab_queue: true,       // 受付だけ使える
    },
  },

  // ── テスト用 ───────────────────────────────────────────────────
  test: {
    label: 'テスト用',
    desc: '全機能ON・LINE未送信。開発・デモ専用',
    emoji: '🧪',
    tailwind: 'bg-purple-900/40 border-purple-500/40 text-purple-300',
    features: {
      // 制服店として全機能ON
      tab_queue: true, tab_repairs: true, tab_inquiries: true, tab_crm: true,
      repairs_tab_purchase: true, repairs_tab_arrival: true, repairs_tab_delivery: true,
      repairs_ocr: true, repairs_master: true, repairs_dummy: true,  // ← テストデータ生成ON
      kantan_line: true, tray_scan: false,
      school_master: true, school_ocr: true, school_crm_card: true,
      school_measurement: true, school_waiting: true,
      line_parent_info: true, line_coupon: true, line_parent_rsv: true,
      customer_self_intake: true, customer_self_order: true,
      queue: true, crm: true, repairs: true, reservation: true,
      orders: true, products: true, purchase_orders: true,
      takeout: false,        // 制服店なのでテイクアウトはOFF
      sms_notify: false, followup_notify: true,
      today_tasks_ui: true, pos: true,
      shift_management: true, shift_inter_store: false, shift_attendance: true,
      shift_leave: true, shift_swap: true, staff_push: true,
      shift_demand: false, shift_dashboard: true, shift_ai: false,
    },
  },

  // ── お直し特化 ─────────────────────────────────────────────────
  repairs_focus: {
    label: 'お直し特化',
    desc: 'お直し・修繕専門店。会計・お渡し管理',
    emoji: '✂️',
    tailwind: 'bg-amber-900/40 border-amber-500/40 text-amber-300',
    features: {
      ...ALL_OFF,
      tab_queue: true,          // 受付
      tab_repairs: true,        // お仕事
      repairs_tab_delivery: true, // お渡し管理
      repairs_master: true,     // 料金マスタ
      tab_crm: true,            // 顧客管理
      pos: true,                // レジ
      repairs: true, crm: true, queue: true,
    },
  },

  // ── かんたん特化 ───────────────────────────────────────────────
  simple: {
    label: 'かんたん特化',
    desc: 'IT不慣れ店舗向け。受付＋お直し＋レジ',
    emoji: '🍀',
    tailwind: 'bg-teal-900/40 border-teal-500/40 text-teal-300',
    features: {
      ...ALL_OFF,
      tab_queue: true,           // 受付
      tab_repairs: true,         // お仕事（シンプルモード）
      repairs_tab_delivery: true,// お渡し
      pos: true,                 // レジ
      repairs: true, queue: true,
    },
  },

  // ── スタンダード ──────────────────────────────────────────────
  standard: {
    label: 'スタンダード',
    desc: '制服販売店の標準。受付・発注・顧客・レジ',
    emoji: '📦',
    tailwind: 'bg-indigo-900/40 border-indigo-500/40 text-indigo-300',
    features: {
      ...ALL_OFF,
      tab_queue: true,
      tab_repairs: true,
      tab_inquiries: true,
      tab_crm: true,
      repairs_tab_purchase: true,
      repairs_tab_arrival: true,
      repairs_tab_delivery: true,
      repairs_master: true,
      school_master: true,
      pos: true,
      queue: true, crm: true, repairs: true, orders: true,
      products: true, purchase_orders: true,
    },
  },

  // ── フル ───────────────────────────────────────────────────────
  full: {
    label: 'フル',
    desc: '全機能。大規模・複数店舗・在校生フォロー対応',
    emoji: '🚀',
    tailwind: 'bg-violet-900/40 border-violet-500/40 text-violet-300',
    features: {
      tab_queue: true, tab_repairs: true, tab_inquiries: true, tab_crm: true,
      repairs_tab_purchase: true, repairs_tab_arrival: true, repairs_tab_delivery: true,
      repairs_ocr: true, repairs_master: true, repairs_dummy: false,
      kantan_line: true, tray_scan: false,
      school_master: true, school_ocr: true, school_crm_card: true,
      school_measurement: true, school_waiting: false,
      line_parent_info: true, line_coupon: true, line_parent_rsv: true,
      customer_self_intake: true, customer_self_order: true,
      queue: true, crm: true, repairs: true, reservation: true,
      orders: true, products: true, purchase_orders: true,
      takeout: false,   // 制服店。テイクアウトは業種設定で別途ON
      sms_notify: false, followup_notify: true,
      today_tasks_ui: false, pos: true,
      shift_management: true, shift_inter_store: false, shift_attendance: true,
      shift_leave: true, shift_swap: true, staff_push: true,
      shift_demand: false, shift_dashboard: true, shift_ai: false,
    },
  },

  // ── Legacy（UI非表示・後方互換のみ）──────────────────────────
  intro:  { label: '導入サンプル（旧）', desc: '', emoji: '🌱', tailwind: 'bg-gray-700 border-gray-600 text-gray-400', hidden: true,
    features: { ...ALL_OFF, tab_queue: true } },
  kantan: { label: 'かんたんLINE（旧）', desc: '', emoji: '🍀', tailwind: 'bg-gray-700 border-gray-600 text-gray-400', hidden: true,
    features: { ...ALL_OFF, tab_queue: true, tab_repairs: true, repairs_tab_delivery: true, pos: true, repairs: true, queue: true } },
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
  // アドオン機能は個別フラグがなければ常にOFF（プラン定義より優先）
  // ※ super-adminで「OFF」と表示される状態と実際の挙動を一致させる
  if (ADDON_DEFAULT_OFF.includes(key)) return false
  // プランから判定
  const rawPlan = (rawFeatures._plan as string | undefined) ?? 'full'
  const plan = rawPlan === 'intro' ? 'free_trial' : rawPlan === 'kantan' ? 'simple' : rawPlan as Plan
  const planDef = PLAN_DEFS[plan] ?? PLAN_DEFS.full
  if (key in planDef.features) {
    return planDef.features[key as FeatureKey] !== false
  }
  // 未定義 = 有効（後方互換）
  return true
}

// 契約時のみ有効化するアドオン/β機能
export const ADDON_DEFAULT_OFF: FeatureKey[] = [
  'sms_notify', 'followup_notify',
  'today_tasks_ui', 'pos',
  'shift_management', 'shift_inter_store',
  'shift_attendance', 'shift_leave', 'shift_swap', 'staff_push',
  'shift_demand', 'shift_dashboard', 'shift_ai',
]

// ── エリア定義（AIシーズンメッセージ用）────────────────────────
export type AreaCode = 'north' | 'central' | 'south' | 'okinawa'

export const AREA_DEFS: Record<AreaCode, { label: string; emoji: string; desc: string }> = {
  north:   { label: '北日本',   emoji: '🌨️', desc: '北海道・東北' },
  central: { label: '中日本',   emoji: '🌸', desc: '関東・中部・近畿' },
  south:   { label: '西日本',   emoji: '☀️', desc: '中国・四国・九州' },
  okinawa: { label: '沖縄',     emoji: '🌺', desc: '沖縄・南西諸島' },
}

