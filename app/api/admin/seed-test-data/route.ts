export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { assertStorePin } from '@/lib/auth/storeAuth'

// ─── テストデータ定義 ──────────────────────────────────────────

const REPAIR_ITEMS = [
  'スラックス（男子）', 'スラックス（女子）', 'ブレザー', 'スカート', 'セーター',
  'ワイシャツ', 'ブラウス', 'ネクタイ', 'リボン', 'ベスト',
]
const REPAIR_CONTENTS = [
  '裾上げ 2cm', '裾上げ 3cm', '裾上げ 4cm', '裾出し 2cm',
  'ウエスト詰め 2cm', 'ウエスト出し 1cm',
  '袖丈詰め 1.5cm', '袖丈詰め 2cm',
  'ほつれ修理', 'ボタン付け直し（3個）', 'ファスナー交換',
  'サイズ変更 S→M', 'サイズ変更 M→L', 'サイズ変更 L→LL',
  'ネーム刺繍（胸）', 'ネーム刺繍（袖）',
]
const PURCHASE_ITEMS = [
  'スラックス（男子）160A', 'スラックス（男子）165A', 'スラックス（男子）170A',
  'スカート 160A', 'スカート 165A',
  'ブレザー（男子）160A', 'ブレザー（男子）165A', 'ブレザー（女子）155A',
  'セーター 160', 'ベスト 155',
  'ワイシャツ 37', 'ワイシャツ 38', 'ブラウス 37',
  'ソックス（白）25cm', 'ソックス（白）26cm',
]
const MAKERS = ['カンコー', 'トンボ', 'スクールタイガー', '明石スクールユニフォームカンパニー', null]
const PURCHASE_STATUSES = ['received', 'ordered', 'on_order', 'on_order', 'stocked'] as const
const REQUEST_TYPES = ['repair', 'repair', 'repair', 'repair', 'walk_in', 'hold_request', 'repair_consult'] as const

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}
function daysLater(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
}

// ─── GET: ドライラン（追加予定件数を返す） ──────────────────────
export async function GET(req: NextRequest) {
  const storeId  = req.nextUrl.searchParams.get('storeId')
  const storePin = req.nextUrl.searchParams.get('storePin') ?? undefined
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

  // 顧客名を含む情報を返すため認証必須
  const denied = await assertStorePin(req, { storeId, storePin })
  if (denied) return denied

  const [{ data: customers }, { data: children }] = await Promise.all([
    (supabase as any).from('customers').select('id, name').eq('store_id', storeId).limit(50),
    (supabase as any).from('children').select('id, name, customer_id').eq('store_id', storeId).limit(50),
  ])

  return NextResponse.json({
    customers: customers?.length ?? 0,
    children:  children?.length ?? 0,
    willInsert: { repairs: 15, purchases: 10 },
    message: 'POST { storeId, dryRun: false } で実行',
  })
}

// ─── POST: テストデータ投入 ─────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { storeId, dryRun = true, count = 15, storePin } = body as {
    storeId?: string
    dryRun?: boolean
    count?: number
    storePin?: string
  }

  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

  // 本番DBへの書き込みのため、店舗PIN（または super-admin）必須
  const denied = await assertStorePin(req, { storeId, storePin })
  if (denied) return denied

  // 実在する顧客・子供を取得
  const [{ data: customersRaw, error: custErr }, { data: childrenRaw }] = await Promise.all([
    (supabase as any).from('customers').select('id, name').eq('store_id', storeId).limit(100),
    (supabase as any).from('children').select('id, name, customer_id, school_name').eq('store_id', storeId).limit(100),
  ])
  const customers = customersRaw as { id: string; name: string }[]
  const children  = childrenRaw  as { id: string; name: string; customer_id: string; school_name: string | null }[] | null

  if (custErr || !customersRaw || customersRaw.length === 0) {
    return NextResponse.json({ error: '顧客データが見つかりません。先に顧客を登録してください。' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const repairRows: Record<string, unknown>[] = []
  const purchaseRows: Record<string, unknown>[] = []

  const repairCount   = Math.round(count * 0.6)
  const purchaseCount = count - repairCount

  // ── お直し依頼 ──────────────────────────────────────────────
  for (let i = 0; i < repairCount; i++) {
    const cust     = rand(customers)
    const childCandidates = children?.filter(c => c.customer_id === cust.id) ?? []
    const child    = childCandidates.length > 0 && Math.random() < 0.7 ? rand(childCandidates) : null
    const reqType  = rand(REQUEST_TYPES)
    const daysBack = Math.floor(Math.random() * 21)
    const hasDead  = reqType === 'repair' && Math.random() < 0.7
    const daysDeadline = Math.floor(Math.random() * 20) - 3  // -3〜+17日後

    repairRows.push({
      store_id:                storeId,
      customer_id:             cust.id,
      child_id:                child?.id ?? null,
      item_name:               rand(REPAIR_ITEMS),
      content:                 reqType === 'repair' ? rand(REPAIR_CONTENTS) : rand(REPAIR_CONTENTS).split('・')[0],
      status:                  'received',
      request_type:            reqType,
      received_date:           daysAgo(daysBack),
      desired_completion_date: hasDead ? daysLater(daysDeadline) : null,
      work_started:            reqType === 'repair' && Math.random() < 0.3,
      prepaid:                 Math.random() < 0.45,
      price:                   rand([500, 800, 1000, 1200, 1500, 2000, 2500, 3000] as const),
      notified:                false,
      is_rework:               Math.random() < 0.05,
      slip_number:             Math.random() < 0.5
        ? `R${new Date().getFullYear().toString().slice(-2)}${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`
        : null,
      created_at: now,
      updated_at: now,
    })
  }

  // ── 発注 ────────────────────────────────────────────────────
  for (let i = 0; i < purchaseCount; i++) {
    const cust    = rand(customers)
    const childCandidates = children?.filter(c => c.customer_id === cust.id) ?? []
    const child   = childCandidates.length > 0 && Math.random() < 0.7 ? rand(childCandidates) : null
    const status  = rand(PURCHASE_STATUSES)
    const daysBack = Math.floor(Math.random() * 14)

    purchaseRows.push({
      store_id:     storeId,
      customer_id:  cust.id,
      child_id:     child?.id ?? null,
      item_name:    rand(PURCHASE_ITEMS),
      maker:        rand(MAKERS),
      notes:        Math.random() < 0.4 ? `${rand(['春', '秋', '入学', '夏'])}用。お急ぎ。` : null,
      status,
      ordered_date: daysAgo(daysBack),
      arrived_date: null,
      price:        rand([3000, 5000, 6000, 8000, 10000, 12000, 15000] as const),
      notified:     false,
      created_at:   now,
      updated_at:   now,
    })
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      repairs:   repairRows.length,
      purchases: purchaseRows.length,
      sampleRepair:   repairRows[0],
      samplePurchase: purchaseRows[0],
    })
  }

  const [repairResult, purchaseResult] = await Promise.all([
    (supabase as any).from('repair_histories').insert(repairRows),
    (supabase as any).from('purchase_orders').insert(purchaseRows),
  ])

  const errors = [
    repairResult.error  ? `repairs: ${repairResult.error.message}`   : null,
    purchaseResult.error ? `purchases: ${purchaseResult.error.message}` : null,
  ].filter(Boolean)

  return NextResponse.json({
    ok:        errors.length === 0,
    inserted:  { repairs: repairRows.length, purchases: purchaseRows.length },
    errors:    errors.length > 0 ? errors : undefined,
  })
}
