export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// シフト交換（shift_swaps）
//   request → accept(相手承諾) → approve(店長承認で staff_id 入替) / reject / cancel
//   入替は service-role で原子的に。
// ============================================================
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, storeId } = body
    if (!action || !storeId) return NextResponse.json({ error: 'action と storeId は必須' }, { status: 400 })
    const sb = getSupabase()

    switch (action) {
      case 'request': {
        const { from_shift_id, from_staff_id, to_staff_id, note } = body
        if (!from_shift_id || !from_staff_id || !to_staff_id)
          return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
        const { data, error } = await sb.from('shift_swaps').insert({
          store_id: storeId, from_shift_id, from_staff_id, to_staff_id, status: 'requested', note: note ?? null,
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ swap: data })
      }
      case 'accept': {   // 交換相手が承諾
        const { swap_id } = body
        const { error } = await sb.from('shift_swaps').update({ status: 'accepted' }).eq('id', swap_id).eq('status', 'requested')
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
      }
      case 'reject': {
        const { swap_id } = body
        await sb.from('shift_swaps').update({ status: 'rejected' }).eq('id', swap_id)
        return NextResponse.json({ ok: true })
      }
      case 'cancel': {
        const { swap_id } = body
        await sb.from('shift_swaps').update({ status: 'cancelled' }).eq('id', swap_id)
        return NextResponse.json({ ok: true })
      }
      case 'approve': {  // 店長承認 → shifts.staff_id を入替
        const { swap_id } = body
        const { data: swap } = await sb.from('shift_swaps').select('*').eq('id', swap_id).maybeSingle()
        if (!swap || (swap as any).store_id !== storeId)
          return NextResponse.json({ error: '交換申請が見つかりません' }, { status: 404 })
        if ((swap as any).status !== 'accepted')
          return NextResponse.json({ error: '相手の承諾後に承認できます' }, { status: 400 })
        const { error: upErr } = await sb.from('shifts')
          .update({ staff_id: (swap as any).to_staff_id, home_store_id: storeId })
          .eq('id', (swap as any).from_shift_id)
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
        await sb.from('shift_swaps').update({ status: 'approved' }).eq('id', swap_id)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: `未対応のaction: ${action}` }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
