// ============================================================
// 来店理由（予約の「ご用件」）
//
//  予約はどの理由でも1枠を使う（枠の長さは店舗設定で固定）。
//  問合せ・ご相談・商品受取は待たせずに対応できるため予約不要とし、
//  予約の選択肢からは外す（お客様には「そのままご来店ください」と案内する）。
//
//  既定は制服店の実務に合わせた3つだけ。
//  それ以外の用件が要る店舗は
//  管理画面 → 設定 → 予約枠の設定 から自分で追加する（stores.reservation_purposes）。
// ============================================================
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export interface VisitPurpose {
  key: string
  label: string
  emoji: string
  /** reservations.service_type に入れる値。'walkin' 始まりは枠を使わない扱いになる */
  serviceType: string
}

/** 店舗が何も設定していないときに使う、予約が必要な用件 */
export const DEFAULT_RESERVABLE_PURPOSES: VisitPurpose[] = [
  { key: 'seifuku',        label: '制服採寸',          emoji: '📏', serviceType: 'visit_saisun_seifuku' },
  { key: 'seifuku_jersey', label: '制服＋ジャージ採寸', emoji: '📐', serviceType: 'visit_saisun_seifuku_jersey' },
  { key: 'jersey',         label: 'ジャージ採寸',      emoji: '👕', serviceType: 'visit_saisun_jersey' },
]

/**
 * 旧名。既定値をそのまま指す。
 * 店舗ごとの設定を反映したい画面では loadReservablePurposes() を使うこと。
 */
export const RESERVABLE_PURPOSES = DEFAULT_RESERVABLE_PURPOSES

/** 予約不要でそのまま来店してよい用件（案内にだけ出す） */
export const WALK_IN_PURPOSES: VisitPurpose[] = [
  { key: 'uketori', label: '商品受取',       emoji: '📦', serviceType: 'walkin_uketori' },
  { key: 'soudan',  label: '問合せ・ご相談', emoji: '💬', serviceType: 'walkin_soudan' },
]

export const ALL_PURPOSES = [...DEFAULT_RESERVABLE_PURPOSES, ...WALK_IN_PURPOSES]

/** 追加された用件に付ける service_type。'walkin' 始まりを避けて枠を使う扱いにする */
export function serviceTypeForNewPurpose(key: string): string {
  return `visit_${key}`
}

/** 設定画面の入力から、キーの重複しない用件を1つ作る */
export function makePurpose(label: string, emoji: string, existing: VisitPurpose[]): VisitPurpose {
  const base = `custom_${Date.now().toString(36)}`
  let key = base
  for (let i = 1; existing.some(p => p.key === key); i++) key = `${base}_${i}`
  return { key, label, emoji: emoji || '📌', serviceType: serviceTypeForNewPurpose(key) }
}

/** DBに入っている値を VisitPurpose[] として読めるかたちに整える */
export function normalizePurposes(raw: unknown): VisitPurpose[] | null {
  if (!Array.isArray(raw)) return null
  const out: VisitPurpose[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    const key   = typeof o.key   === 'string' ? o.key.trim()   : ''
    if (!label || !key) continue
    const serviceType = typeof o.serviceType === 'string' && o.serviceType.trim()
      ? o.serviceType.trim()
      : serviceTypeForNewPurpose(key)
    out.push({
      key,
      label,
      emoji: typeof o.emoji === 'string' && o.emoji ? o.emoji : '📌',
      // 予約の用件が 'walkin' 始まりだと枠を使わない扱いになってしまう（lib/fittingTypes）
      serviceType: serviceType.toLowerCase().startsWith('walkin') ? serviceTypeForNewPurpose(key) : serviceType,
    })
  }
  return out.length > 0 ? out : null
}

/** その店舗の「予約が必要な用件」。未設定なら既定の3つ */
export async function loadReservablePurposes(storeId: string): Promise<VisitPurpose[]> {
  const { data } = await sb.from('stores')
    .select('reservation_purposes').eq('id', storeId).maybeSingle()
  return normalizePurposes(data?.reservation_purposes) ?? DEFAULT_RESERVABLE_PURPOSES
}
