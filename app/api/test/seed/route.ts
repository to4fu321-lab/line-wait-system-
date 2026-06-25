export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const { storeId } = await req.json()
  if (!storeId) return NextResponse.json({ ok: false, error: 'no storeId' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const created: string[] = []

  try {
    // 0. マスタから学校・商品を取得してテストデータに反映
    const { data: masterSchools } = await (supabase as any).from('schools')
      .select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order').limit(5)

    type MasterProduct = { name: string; price: number | null }
    let masterProducts: MasterProduct[] = []
    if (masterSchools && (masterSchools as any[]).length > 0) {
      const { data: prods } = await (supabase as any).from('school_products')
        .select('item_name, school_id, school_product_variants(price, sort_order)')
        .in('school_id', (masterSchools as any[]).map(s => s.id))
        .eq('active', true).order('sort_order').limit(20)
      if (prods) {
        masterProducts = (prods as any[]).map(p => {
          const variants = ((p.school_product_variants ?? []) as { price: number | null; sort_order: number }[])
          variants.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          return { name: p.item_name as string, price: variants[0]?.price ?? null }
        })
      }
    }

    const schoolForIdx = (i: number): string => {
      if (masterSchools && (masterSchools as any[]).length > 0) {
        return (masterSchools as any[])[i % (masterSchools as any[]).length].name
      }
      return i < 3 ? '○○中学校' : '○○高等学校'
    }

    const mp = (i: number): MasterProduct | null => masterProducts[i] ?? null

    // 1. テスト顧客定義（学校はマスタに合わせる）
    const TEST_CUSTOMERS = [
      { name: '【テスト】田中 太郎', kana: 'タナカ タロウ', tel: '090-0001-0001',
        child: { name: '田中 太一', kana: 'タナカ タイチ', school: schoolForIdx(0), grade: '中学1年', gender: 'male' } },
      { name: '【テスト】佐藤 花子', kana: 'サトウ ハナコ', tel: '090-0002-0002',
        child: { name: '佐藤 さくら', kana: 'サトウ サクラ', school: schoolForIdx(1), grade: '中学2年', gender: 'female' } },
      { name: '【テスト】鈴木 次郎', kana: 'スズキ ジロウ', tel: '090-0003-0003',
        child: { name: '鈴木 健一', kana: 'スズキ ケンイチ', school: schoolForIdx(2), grade: '高校1年', gender: 'male' } },
      { name: '【テスト】山田 美咲', kana: 'ヤマダ ミサキ', tel: '090-0004-0004',
        child: { name: '山田 ひなた', kana: 'ヤマダ ヒナタ', school: schoolForIdx(3), grade: '高校2年', gender: 'female' } },
      { name: '【テスト】伊藤 健太', kana: 'イトウ ケンタ', tel: '090-0005-0005',
        child: { name: '伊藤 翔', kana: 'イトウ ショウ', school: schoolForIdx(4), grade: '中学3年', gender: 'male' } },
    ]

    // 2. 顧客・お子様を作成（再実行時は既存レコードを検索してIDを使う）
    const customerIds: (string | null)[] = []
    const childIds:    (string | null)[] = []

    for (const tc of TEST_CUSTOMERS) {
      let custId:  string | null = null
      let childId: string | null = null

      const { data: newCust, error: custErr } = await (supabase as any).from('customers').insert({
        store_id: storeId, name: tc.name, kana: tc.kana, tel: tc.tel,
      }).select('id').single()

      if (newCust) {
        custId = newCust.id
        created.push(`顧客: ${tc.name}`)
        const { data: newChild } = await (supabase as any).from('children').insert({
          customer_id: custId, store_id: storeId,
          name: tc.child.name, kana: tc.child.kana,
          school_name: tc.child.school, grade: tc.child.grade,
        }).select('id').single()
        childId = newChild?.id ?? null
        if (childId) created.push(`  お子様: ${tc.child.name}（${tc.child.school} ${tc.child.grade}）`)
      } else {
        console.warn('[seed] customer insert skipped, looking up existing:', custErr?.message)
        const { data: existing } = await (supabase as any).from('customers')
          .select('id').eq('store_id', storeId).eq('name', tc.name).single()
        if (existing) {
          custId = existing.id
          const { data: existChild } = await (supabase as any).from('children')
            .select('id').eq('customer_id', custId).limit(1).single()
          if (existChild) childId = existChild.id
        }
      }

      customerIds.push(custId)
      childIds.push(childId)
    }

    // 3. 整理券（待ち）3件 — 身長・体重の事前入力テスト用
    const todayJst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    const { data: maxRows } = await (supabase as any).from('queues')
      .select('ticket_number').eq('store_id', storeId)
      .gte('created_at', todayJst + 'T00:00:00+09:00')
      .order('ticket_number', { ascending: false }).limit(1)
    const baseTicket = (maxRows?.[0]?.ticket_number ?? 0)

    const queueDetails = [
      { height: '165', weight: '55',  note: '' },
      { height: '158', weight: '48',  note: '' },
      { height: '172', weight: '60',  note: 'ズボンのすそ上げも希望' },
    ]
    for (let i = 0; i < 3; i++) {
      const ticketNum = baseTicket + i + 1
      const tc = TEST_CUSTOMERS[i]
      const d  = queueDetails[i]
      const details: Record<string, string> = {}
      if (d.height) details.height = d.height
      if (d.weight) details.weight = d.weight
      if (d.note)   details.note   = d.note

      const { error: qErr } = await (supabase as any).from('queues').insert({
        store_id: storeId, ticket_number: ticketNum, status: 'waiting',
        customer_name: tc.name.replace('【テスト】', ''),
        child_name: tc.child.name,
        school_name: tc.child.school,
        category: 'fitting', gender: tc.child.gender === 'male' ? 'male' : 'female',
        line_user_id: null, checked_in: true,
        customer_id: customerIds[i] ?? null,
        child_id:    childIds[i]    ?? null,
        details:     Object.keys(details).length ? details : null,
      })
      if (qErr) { console.error('[seed] queue insert error:', qErr.message); continue }
      created.push(`整理券: No.${String(ticketNum).padStart(3,'0')} ${tc.name.replace('【テスト】','')}`)
    }

    // 4. 取置き依頼 — マスタ商品があれば実商品名・価格を使用
    const purchases = [
      { idx: 0, item: mp(0)?.name ?? 'ワイシャツ（長袖）（170）',  price: mp(0)?.price ?? 3200,  status: 'ordered',   ordered: today,        arrived: null,        note: '数量：1点' },
      { idx: 1, item: mp(1)?.name ?? 'ブレザー（M）',              price: mp(1)?.price ?? 18000, status: 'on_order',  ordered: daysAgo(5),   arrived: null,        note: 'メーカー取り寄せ' },
      { idx: 2, item: mp(2)?.name ?? 'スラックス（W72）',           price: mp(2)?.price ?? 5800,  status: 'arrived',   ordered: daysAgo(10),  arrived: daysAgo(3),  note: '' },
      { idx: 3, item: mp(3)?.name ?? 'セーラー服（M）',             price: mp(3)?.price ?? 12000, status: 'arrived',   ordered: daysAgo(20),  arrived: daysAgo(10), note: '連絡済みだが未取りに来ない' },
      { idx: 4, item: mp(4)?.name ?? '体操服上下セット',            price: mp(4)?.price ?? 4500,  status: 'delivered', ordered: daysAgo(14),  arrived: daysAgo(7),  note: '' },
    ]
    for (const p of purchases) {
      const cId  = customerIds[p.idx]
      const chId = childIds[p.idx]
      if (!cId) { console.warn('[seed] purchase skip: no customer for idx', p.idx); continue }
      const row: Record<string, unknown> = {
        store_id: storeId, customer_id: cId, child_id: chId ?? null,
        item_name: p.item, notes: p.note || null, price: p.price,
        status: p.status, ordered_date: p.ordered,
      }
      if (p.arrived)                row.arrived_date   = p.arrived
      if (p.status === 'delivered') row.delivered_date = today
      const { error: pErr } = await ((supabase as any).from('purchase_orders') as any).insert(row)
      if (pErr) { console.error('[seed] purchase_orders insert error:', pErr.message, 'item:', p.item); continue }
      created.push(`取置き[${p.status}]: ${p.item}`)
    }

    // 5. お直し・問合せ依頼 — 各ステータス・各タイプを網羅（期限超過テスト含む）
    const repairs = [
      { idx: 0, item: mp(2)?.name ?? 'スカート丈つめ',       content: '3cm短く',                               price: 1500, status: 'received',  requestType: 'repair',         received: today,       completed: null,        delivered: null },
      { idx: 1, item: mp(1)?.name ?? 'ズボン丈つめ',          content: '2cm短く',                               price: 1200, status: 'completed', requestType: 'repair',         received: daysAgo(7),  completed: daysAgo(3),  delivered: null },
      { idx: 2, item: mp(0)?.name ?? 'ブレザー',             content: '採寸・見積り相談',                       price: null, status: 'received',  requestType: 'repair_consult', received: daysAgo(1),  completed: null,        delivered: null },
      { idx: 3, item: mp(2)?.name ?? 'スカートウエスト調整', content: 'ウエスト調整2cm詰め',                    price: 1800, status: 'completed', requestType: 'repair',         received: daysAgo(18), completed: daysAgo(10), delivered: null },
      { idx: 4, item: 'サイズ確認の問合せ',                  content: `${mp(0)?.name ?? '制服'}のサイズについて確認したい`, price: null, status: 'received', requestType: 'inquiry', received: daysAgo(2), completed: null, delivered: null },
    ]
    for (const r of repairs) {
      const cId  = customerIds[r.idx]
      const chId = childIds[r.idx]
      if (!cId) { console.warn('[seed] repair skip: no customer for idx', r.idx); continue }
      const row: Record<string, unknown> = {
        store_id: storeId, customer_id: cId, child_id: chId ?? null,
        item_name: r.item, content: r.content, price: r.price,
        status: r.status, received_date: r.received,
        request_type: r.requestType,
      }
      if (r.completed)  row.completed_date  = r.completed
      if (r.delivered)  row.delivered_date  = r.delivered
      const { error: rErr } = await (supabase as any).from('repair_histories').insert(row)
      if (rErr) { console.error('[seed] repair_histories insert error:', rErr.message, 'item:', r.item); continue }
      created.push(`${r.requestType}[${r.status}]: ${r.item}`)
    }

    const usedMaster = masterProducts.length > 0
      ? `（マスタ商品 ${masterProducts.length}件・学校 ${(masterSchools as any[]).length}校を参照）`
      : '（マスタ商品未登録のためデフォルト品名を使用）'
    return NextResponse.json({ ok: true, created, note: usedMaster })
  } catch (e) {
    console.error('[test/seed]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
