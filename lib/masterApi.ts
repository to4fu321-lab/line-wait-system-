'use client'

// ============================================================
// 商品マスタ アクセス層(クライアント側の入口)
//
//   商品マスタ(schools / size_sets / products / school_requirements /
//   prices と互換ビュー)はブラウザから直接読み書きしない。必ずこの
//   ヘルパー経由でサーバーAPIを呼ぶ。
//
//   理由: anon キーは JS バンドルに載る公開キーなので、テーブルを直接
//   開放すると「storeId を書き換えれば他店の商品・価格を読める/消せる」
//   状態になる。サーバー側で店舗を固定するのが唯一の防ぎ方。
//
//     /api/master/catalog   … 店舗スコープの読み取り(顧客画面も使う。原価は返らない)
//     /api/master/crud      … 追加・更新・削除と原価つき読み取り(店舗PIN必須)
//     /api/master/directory … 学校名→住所・電話の名簿(店舗PIN必須)
// ============================================================

/** 管理画面がPIN認証済みのときに保持している店舗PIN */
export function adminPin(storeId: string): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
}

async function getJson<T>(url: string): Promise<T> {
  const res  = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string })?.error || `APIエラー (${res.status})`)
  return json as T
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string })?.error || `APIエラー (${res.status})`)
  return json as T
}

// ── 店舗スコープの読み取り(公開)──────────────────────────────

export interface CatalogSchool {
  id: string; name: string; short_name: string | null; sort_order: number
}
export interface CatalogProduct {
  id: string; item_name: string; category: string | null; gender: string | null
  maker?: string | null; maker_code: string | null; notes?: string | null
  required?: boolean; sort_order: number; school_id?: string
}
export interface CatalogVariant {
  id: string; product_id: string; size_label: string; price: number; sort_order: number
}

const catalog = (storeId: string, params: Record<string, string>) => {
  const q = new URLSearchParams({ storeId, ...params })
  return `/api/master/catalog?${q.toString()}`
}

/** 自店の学校一覧(公開列のみ) */
export async function fetchSchools(storeId: string): Promise<CatalogSchool[]> {
  const { schools } = await getJson<{ schools: CatalogSchool[] }>(catalog(storeId, { schools: '1' }))
  return schools ?? []
}

/** その学校の商品一覧 */
export async function fetchSchoolProducts(storeId: string, schoolId: string): Promise<CatalogProduct[]> {
  const { products } = await getJson<{ products: CatalogProduct[] }>(catalog(storeId, { schoolId }))
  return products ?? []
}

/** サイズ・価格(仕入原価は返らない) */
export async function fetchVariants(storeId: string, productIds: string[]): Promise<CatalogVariant[]> {
  if (productIds.length === 0) return []
  const { variants } = await getJson<{ variants: CatalogVariant[] }>(
    catalog(storeId, { productIds: productIds.join(',') }))
  return variants ?? []
}

/** 商品名だけ引く(購入履歴の表示用) */
export async function fetchProductNames(storeId: string, ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {}
  const { products } = await getJson<{ products: { id: string; item_name: string }[] }>(
    catalog(storeId, { productNames: ids.join(',') }))
  const map: Record<string, string> = {}
  for (const p of products ?? []) map[p.id] = p.item_name
  return map
}

/** バーコードから商品1件＋サイズ・価格 */
export async function fetchByBarcode(storeId: string, barcode: string): Promise<{
  product: CatalogProduct | null; variants: CatalogVariant[]
}> {
  return getJson(catalog(storeId, { barcode }))
}

// ── 追加・更新・削除(店舗PIN必須)─────────────────────────────

export type MasterResource =
  | 'schools' | 'size_sets' | 'products' | 'school_requirements' | 'prices' | 'processing_options'

/** マスタCRUDの共通呼び出し。PINはこの中で sessionStorage から補う */
export function masterCrud<T>(
  storeId: string, resource: MasterResource, action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  return postJson<T>('/api/master/crud', {
    storeId, storePin: adminPin(storeId), resource, action, ...payload,
  })
}

/** 学校名から住所・電話の候補を引く(他店の登録も検索する唯一の口) */
export async function searchSchoolDirectory(storeId: string, query: string): Promise<{
  id: string; name: string; kana: string | null; address: string | null; tel: string | null; own: boolean
}[]> {
  try {
    const { hits } = await postJson<{ hits: [] }>('/api/master/directory', {
      storeId, storePin: adminPin(storeId), query,
    })
    return hits ?? []
  } catch {
    return []   // 候補は補助機能。取れなくても手入力で進める
  }
}
