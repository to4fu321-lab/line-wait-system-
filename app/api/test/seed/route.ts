import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TEST_CUSTOMERS = [
  { name: '【テスト】田中 太郎', kana: 'タナカ タロウ', tel: '090-0001-0001',
    child: { name: '田中 太一', kana: 'タナカ タイチ', school: '○○中学校', grade: '中学1年', gender: 'male' } },
  { name: '【テスト】佐藤 花子', kana: 'サトウ ハナコ', tel: '090-0002-0002',
    child: { name: '佐藤 さくら', kana: 'サトウ サクラ', school: '○○中学校', grade: '中学2年', gender: 'female' } },
  { name: '【テスト】鈴木 次郎', kana: 'スズキ ジロウ', tel: '090-0003-0003',
    child: { name: '鈴木 健一', kana: 'スズキ ケンイチ', school: '○○高等学校', grade: '高校1年', gender: 'male' } },
  { name: '【テスト】山田 美咲', kana: 'ヤマダ ミサキ', tel: '090-0004-0004',
    child: { name: '山田 ひなた', kana: 'ヤマダ ヒナタ', school: '○○高等学校', grade: '高校2年', gender: 'female' } },
  { name: '【テスト】伊藤 健太', kana: 'イトウ ケンタ', tel: '090-0005-0005',
    child: { name: '伊藤 翔', kana: 'イトウ ショウ', school: '○○中学校', grade: '中学3年', gender: 'male' } },
]

const TEST_PURCHASES = [
  { customerIdx: 0, item: 'ワイシャツ（長袖）（170）', price: 3200 },
  { customerIdx: 1, item: 'ブレザー（M）',            price: 18000 },
  { customerIdx: 2, item: 'スラックス（W72）',        price: 5800 },
]

const TEST_REPAIRS = [
  { customerIdx: 3, item: 'スカート丈つめ', content: '3cm短く', price: 1500 },
  { customerIdx: 4, item: 'ズボン丈つめ',   content: '2cm短く', price: 1200 },
]

export async function POST(req: NextRequest) {
  const { storeId } = await req.json()
  if (!storeId) return NextResponse.json({ ok: false, error: 'no storeId' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const created: string[] = []

  try {
    // 1. 顧客・お子様を作成
    const customerIds: string[] = []
    const childIds: (string | null)[] = []

    for (const tc of TEST_CUSTOMERS) {
      const { data: cust } = await supabase.from('customers').insert({
        store_id: storeId, name: tc.name, kana: tc.kana, tel: tc.tel,
      }).select('id').single()
      if (!cust) continue
      customerIds.push(cust.id)

      const { data: child } = await supabase.from('children').insert({
        customer_id: cust.id, store_id: storeId,
        name: tc.child.name, kana: tc.child.kana,
        school_name: tc.child.school, grade: tc.child.grade,
      }).select('id').single()
      childIds.push(child?.id ?? null)
      created.push(`顧客: ${tc.name}`)
    }

    // 2. 整理券（待ち）を3件
    const todayJst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
    const { data: maxRows } = await supabase.from('queues')
      .select('ticket_number').eq('store_id', storeId)
      .gte('created_at', todayJst + 'T00:00:00+09:00')
      .order('ticket_number', { ascending: false }).limit(1)
    const baseTicket = (maxRows?.[0]?.ticket_number ?? 0)
    for (let i = 0; i < 3; i++) {
      const ticketNum = baseTicket + i + 1
      const tc = TEST_CUSTOMERS[i]
      const { error: qErr } = await supabase.from('queues').insert({
        store_id: storeId, ticket_number: ticketNum, status: 'waiting',
        customer_name: tc.name.replace('【テスト】', ''),
        child_name: tc.child.name,
        school_name: tc.child.school,
        category: 'school', gender: tc.child.gender === 'male' ? 'male' : 'female',
        line_user_id: null, checked_in: true,
        customer_id: customerIds[i] ?? null,
        child_id: childIds[i] ?? null,
      })
      if (qErr) { console.error('[seed] queue insert error:', qErr.message); continue }
      created.push(`整理券: No.${String(ticketNum).padStart(3,'0')} ${tc.name.replace('【テスト】','')}`)
    }

    // 3. 取置き依頼
    for (const tp of TEST_PURCHASES) {
      const cId = customerIds[tp.customerIdx]
      const chId = childIds[tp.customerIdx]
      if (!cId) continue
      await (supabase.from('purchase_orders') as any).insert({
        store_id: storeId, customer_id: cId, child_id: chId ?? null,
        item_name: tp.item, notes: '数量：1点', price: tp.price,
        status: 'ordered', ordered_date: today,
      })
      created.push(`取置き: ${tp.item}`)
    }

    // 4. お直し依頼
    for (const tr of TEST_REPAIRS) {
      const cId = customerIds[tr.customerIdx]
      const chId = childIds[tr.customerIdx]
      if (!cId) continue
      await supabase.from('repair_histories').insert({
        store_id: storeId, customer_id: cId, child_id: chId ?? null,
        item_name: tr.item, content: tr.content, price: tr.price,
        status: 'received', received_date: today,
      })
      created.push(`お直し: ${tr.item}`)
    }

    return NextResponse.json({ ok: true, created })
  } catch (e) {
    console.error('[test/seed]', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
