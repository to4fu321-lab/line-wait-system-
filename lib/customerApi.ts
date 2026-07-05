'use client'

// ============================================================
// 顧客導線用 API クライアント
//   customers / children / queues / takeout / reservations は
//   RLS によりクライアント(anonキー)から直接読み書きできない。
//   顧客画面は必ずこのヘルパー経由でサーバーAPIを呼ぶこと。
//   本人確認: LIFF アクセストークン(サーバーで LINE API 検証)
//   自チケット/自注文: UUID を知っていること(localStorage 保持)
// ============================================================

import { getLineAccessToken } from '@/lib/liff'

async function callApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error || `APIエラー (${res.status})`)
  return json as T
}

function post<T>(url: string, body: Record<string, unknown>): Promise<T> {
  return callApi<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── 顧客(本人) ───────────────────────────────────────────────

export interface CustomerSession {
  customer: any | null
  children: any[]
  lineUserId?: string
  displayName?: string | null
}

/** LINE本人の顧客レコード+お子様一覧。LIFF外・未ログインは customer:null */
export async function fetchCustomerSession(storeId: string): Promise<CustomerSession> {
  const accessToken = await getLineAccessToken()
  if (!accessToken) return { customer: null, children: [] }
  try {
    return await post<CustomerSession>('/api/customer/session', { storeId, accessToken })
  } catch {
    return { customer: null, children: [] }
  }
}

export interface SaveCustomerPayload {
  customer?: Record<string, unknown>
  childInsert?: Record<string, unknown>
  childUpdate?: Record<string, unknown> & { id: string }
}

/** 本人の顧客情報 upsert / お子様追加・更新 */
export async function saveCustomer(storeId: string, payload: SaveCustomerPayload):
  Promise<{ customer: any; children: any[]; child: any | null }> {
  const accessToken = await getLineAccessToken()
  if (!accessToken) throw new Error('LINE認証に失敗しました。LINEアプリから開き直してください。')
  return post('/api/customer/save', { storeId, accessToken, ...payload })
}

// ── 順番待ち ─────────────────────────────────────────────────

export interface QueueState {
  isOpen: boolean
  activeFittings: number | null
  waitingCount: number
  ticket: any | null
  waitingAhead: number | null
}

export function fetchQueueState(storeId: string, ticketId?: string | null): Promise<QueueState> {
  const q = ticketId ? `&ticketId=${encodeURIComponent(ticketId)}` : ''
  return callApi<QueueState>(`/api/queue/state?storeId=${encodeURIComponent(storeId)}${q}`, { cache: 'no-store' })
}

/** 整理券発行(LINE本人確認は任意) */
export async function issueTicket(storeId: string, opts: {
  childId?: string | null; isRemote?: boolean; details?: Record<string, unknown> | null
} = {}): Promise<any> {
  const accessToken = await getLineAccessToken()
  const { ticket } = await post<{ ticket: any }>('/api/queue/issue', {
    storeId, accessToken,
    childId: opts.childId ?? null,
    isRemote: !!opts.isRemote,
    details: opts.details ?? null,
  })
  return ticket
}

export type TicketAction = 'cancel' | 'complete' | 'checkin' | 'set_info' | 'set_details'

/** 自チケットへの操作(cancel / complete / checkin / set_info / set_details) */
export async function ticketAction(
  storeId: string, ticketId: string, action: TicketAction,
  extra: Record<string, unknown> = {},
): Promise<any> {
  const { ticket } = await post<{ ticket: any }>('/api/queue/ticket', { storeId, ticketId, action, ...extra })
  return ticket
}

// ── テイクアウト ─────────────────────────────────────────────

export async function lookupTakeoutOrder(storeId: string): Promise<{ order: any | null; displayName?: string | null }> {
  const accessToken = await getLineAccessToken()
  if (!accessToken) return { order: null }
  try {
    return await post('/api/takeout/lookup', { storeId, accessToken })
  } catch {
    return { order: null }
  }
}

export async function placeTakeoutOrder(storeId: string, payload: {
  customerName?: string; notes?: string; pickupTime?: string | null
  items: { menuId: string; quantity: number }[]
}): Promise<any> {
  const accessToken = await getLineAccessToken()
  const { order } = await post<{ order: any }>('/api/takeout/place', { storeId, accessToken, ...payload })
  return order
}

export async function addTakeoutItems(storeId: string, orderId: string,
  items: { menuId: string; quantity: number }[]): Promise<any> {
  const { order } = await post<{ order: any }>('/api/takeout/add-items', { storeId, orderId, items })
  return order
}

export function fetchTakeoutState(storeId: string, orderId: string): Promise<{ order: any }> {
  return callApi(`/api/takeout/state?storeId=${encodeURIComponent(storeId)}&orderId=${encodeURIComponent(orderId)}`, { cache: 'no-store' })
}

// ── 予約 ─────────────────────────────────────────────────────

export function fetchReservationsOfDay(storeId: string, date: string):
  Promise<{ reservations: { reserved_at: string; service_type: string | null; purpose: string | null }[] }> {
  return callApi(`/api/reserve/day?storeId=${encodeURIComponent(storeId)}&date=${encodeURIComponent(date)}`, { cache: 'no-store' })
}

export async function createReservation(storeId: string, payload: {
  childId?: string | null; reservedAt: string; serviceType?: string; purpose?: string; notes?: string
}): Promise<void> {
  const accessToken = await getLineAccessToken()
  await post('/api/reserve/create', { storeId, accessToken, ...payload })
}

// ── EC(学販セルフ注文)──────────────────────────────────────

export async function placeEcOrder(storeId: string, payload: {
  childId?: string | null; items: { variantId: string; qty: number }[]
}): Promise<void> {
  const accessToken = await getLineAccessToken()
  if (!accessToken) throw new Error('LINE認証に失敗しました。LINEアプリから開き直してください。')
  await post('/api/ec/order', { storeId, accessToken, ...payload })
}

// ── マイページ ───────────────────────────────────────────────

export async function fetchMypage(storeId: string): Promise<{
  customer: any | null; children?: any[]; purchases?: any[]; repairs?: any[]
  queueMeasurements?: { child_id: string | null; created_at: string; details: any }[]
}> {
  const accessToken = await getLineAccessToken()
  if (!accessToken) throw new Error('LINE認証に失敗しました')
  return post('/api/mypage', { storeId, accessToken })
}
