import { describe, it, expect, beforeEach, vi } from 'vitest'
// vi.mock はファイル先頭に巻き上げられるため、下の import より先にモックが効く
import { POST } from '@/app/api/ec/order/route'

// ============================================================================
//  LINEセルフ注文 (POST /api/ec/order) の検証ロジック
//
//  UIを信用せずサーバー側で弾かなければならないもの:
//    - 他店舗の variantId（store_id で絞らないと他店の商品が注文できてしまう）
//    - 在籍校以外の商品（進学・転校は学校登録を変更してから）
//    - プラン未契約店舗への直接API投稿
//  いずれも実際に穴が空いていた箇所なので、退行したら必ずここで落ちること。
// ============================================================================

const inserted: Record<string, unknown>[] = []
let tables: Record<string, Record<string, unknown>[]> = {}
let verifiedUser: { userId: string; displayName: string | null } | null = null

/** supabase-js のクエリビルダを eq / in / limit だけ再現した簡易フェイク */
function makeBuilder(table: string) {
  const filters: ((r: Record<string, unknown>) => boolean)[] = []
  let limitN: number | null = null
  const rows = () => {
    const out = (tables[table] ?? []).filter(r => filters.every(f => f(r)))
    return limitN === null ? out : out.slice(0, limitN)
  }
  const b: Record<string, unknown> = {
    select: () => b,
    order:  () => b,
    eq: (col: string, v: unknown) => { filters.push(r => r[col] === v); return b },
    in: (col: string, vs: unknown[]) => { filters.push(r => vs.includes(r[col])); return b },
    limit: (n: number) => { limitN = n; return b },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    single:      async () => ({ data: rows()[0] ?? null, error: null }),
    insert: async (newRows: Record<string, unknown>[]) => { inserted.push(...newRows); return { error: null } },
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: rows(), error: null }).then(resolve),
  }
  return b
}

vi.mock('@/lib/supabaseAdmin', () => ({
  createAdminClient: () => ({ from: (t: string) => makeBuilder(t) }),
}))
vi.mock('@/lib/auth/lineAuth', () => ({
  verifyLineAccessToken: async () => verifiedUser,
}))

const STORE = 'store-A'
const OTHER_STORE = 'store-B'
const SCHOOL = 'school-1'
const OTHER_SCHOOL = 'school-2'

/** 正常系のデータ一式。個々のテストで一部だけ差し替える */
function seed() {
  tables = {
    stores: [{ id: STORE, features: {} }, { id: OTHER_STORE, features: {} }],
    customers: [{
      id: 'cust-1', store_id: STORE, line_user_id: 'U1',
      deleted_at: null, school_id: null, school_name: null,
    }],
    children: [
      { id: 'child-1', customer_id: 'cust-1', school_id: SCHOOL,       school_name: '第一中学校' },
      { id: 'child-x', customer_id: 'cust-other', school_id: SCHOOL,   school_name: '第一中学校' },
    ],
    schools: [
      { id: SCHOOL,       store_id: STORE, name: '第一中学校' },
      { id: OTHER_SCHOOL, store_id: STORE, name: '第二高校' },
    ],
    school_products: [
      { id: 'prod-1',     store_id: STORE,       active: true, item_name: '学生服上着', school_id: SCHOOL },
      { id: 'prod-other', store_id: STORE,       active: true, item_name: '別校ブレザー', school_id: OTHER_SCHOOL },
      { id: 'prod-b',     store_id: OTHER_STORE, active: true, item_name: '他店の制服',   school_id: 'school-b' },
    ],
    school_product_variants: [
      { id: 'var-1',     store_id: STORE,       active: true, product_id: 'prod-1',     size_label: '160', price: 10000 },
      { id: 'var-off',   store_id: STORE,       active: false, product_id: 'prod-1',    size_label: '165', price: 10500 },
      { id: 'var-other', store_id: STORE,       active: true, product_id: 'prod-other', size_label: 'M',   price: 20000 },
      { id: 'var-b',     store_id: OTHER_STORE, active: true, product_id: 'prod-b',     size_label: 'L',   price: 30000 },
    ],
    purchase_orders: [],
  }
}

function req(body: Record<string, unknown>) {
  return new Request('http://localhost/api/ec/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: STORE, accessToken: 'tok', childId: 'child-1', ...body }),
  })
}

beforeEach(() => {
  inserted.length = 0
  verifiedUser = { userId: 'U1', displayName: 'テスト' }
  seed()
})

describe('POST /api/ec/order', () => {
  it('在籍校の商品なら注文できる（価格はサーバー側で再計算）', async () => {
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 2 }] }))
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      store_id: STORE, customer_id: 'cust-1', child_id: 'child-1',
      item_name: '学生服上着 160', price: 20000, status: 'ordered',
    })
  })

  it('他店舗の variantId は注文できない', async () => {
    const res = await POST(req({ items: [{ variantId: 'var-b', qty: 1 }] }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('自店の商品に他店舗の variantId を混ぜても通らない', async () => {
    const res = await POST(req({ items: [
      { variantId: 'var-1', qty: 1 }, { variantId: 'var-b', qty: 1 },
    ] }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('同じ店舗でも在籍校以外の商品は注文できない', async () => {
    const res = await POST(req({ items: [{ variantId: 'var-other', qty: 1 }] }))
    expect(res.status).toBe(403)
    expect(inserted).toHaveLength(0)
  })

  it('学校を変更すれば新しい学校の商品を注文できる（進学導線）', async () => {
    tables.children[0].school_id   = OTHER_SCHOOL
    tables.children[0].school_name = '第二高校'
    const res = await POST(req({ items: [{ variantId: 'var-other', qty: 1 }] }))
    expect(res.status).toBe(200)
    expect(inserted[0]).toMatchObject({ item_name: '別校ブレザー M', price: 20000 })
  })

  it('school_id 未設定の古いレコードは学校名で解決する', async () => {
    tables.children[0].school_id = null
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(200)
  })

  it('学校が未登録なら注文できない', async () => {
    tables.children[0].school_id   = null
    tables.children[0].school_name = null
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('他人のお子様IDは使えない', async () => {
    const res = await POST(req({ childId: 'child-x', items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(404)
    expect(inserted).toHaveLength(0)
  })

  it('取扱停止中のサイズは注文できない', async () => {
    const res = await POST(req({ items: [{ variantId: 'var-off', qty: 1 }] }))
    expect(res.status).toBe(400)
  })

  it('プラン未契約の店舗は API を直接叩いても注文できない', async () => {
    tables.stores[0].features = { customer_self_order: false }
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(403)
    expect(inserted).toHaveLength(0)
  })

  it('LINE認証が通らなければ401', async () => {
    verifiedUser = null
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(401)
  })

  it('会員登録がなければ404', async () => {
    tables.customers = []
    const res = await POST(req({ items: [{ variantId: 'var-1', qty: 1 }] }))
    expect(res.status).toBe(404)
  })

  it('同じ商品が複数行で届いても1行にまとめる', async () => {
    const res = await POST(req({ items: [
      { variantId: 'var-1', qty: 1 }, { variantId: 'var-1', qty: 2 },
    ] }))
    expect(res.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ price: 30000, notes: '3点' })
  })

  it('数量が不正なら弾く', async () => {
    for (const qty of [0, -1, 100, 1.5, Number.NaN]) {
      const res = await POST(req({ items: [{ variantId: 'var-1', qty }] }))
      expect(res.status, `qty=${qty}`).toBe(400)
    }
    expect(inserted).toHaveLength(0)
  })

  it('まとめた結果が上限を超える場合も弾く', async () => {
    const res = await POST(req({ items: [
      { variantId: 'var-1', qty: 60 }, { variantId: 'var-1', qty: 60 },
    ] }))
    expect(res.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })
})
