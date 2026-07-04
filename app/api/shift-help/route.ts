export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// ============================================================
// 店舗間スタッフヘルプ(同一グループ内)
//   グループ横断の read/write のため service-role で実行。
//   呼び出し元店舗の group_id を引き、グループ所属を検証する。
//   actions: create_request / list_group_requests / offer / assign
//            / decline_offer / cancel
// ============================================================

type SB = ReturnType<typeof createAdminClient>

async function getStore(sb: SB, storeId: string) {
  const { data } = await sb.from('stores').select('id, name, group_id').eq('id', storeId).maybeSingle()
  return data as { id: string; name: string; group_id: string | null } | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, storeId } = body as { action: string; storeId: string }
    if (!action || !storeId) {
      return NextResponse.json({ error: 'action と storeId は必須です' }, { status: 400 })
    }
    const sb = createAdminClient()
    const store = await getStore(sb, storeId)
    if (!store) return NextResponse.json({ error: '店舗が見つかりません' }, { status: 404 })
    if (!store.group_id) return NextResponse.json({ error: 'この店舗はグループに属していません' }, { status: 400 })
    const groupId = store.group_id

    switch (action) {
      // ── 募集を作成(募集店) ──
      case 'create_request': {
        const { work_date, start_time, end_time, headcount, position, note } = body
        if (!work_date || !start_time || !end_time) {
          return NextResponse.json({ error: '日付・時間は必須です' }, { status: 400 })
        }
        const { data, error } = await sb.from('shift_help_requests').insert({
          group_id: groupId,
          requesting_store_id: storeId,
          work_date, start_time, end_time,
          headcount: headcount ?? 1,
          position: position ?? null,
          note: note ?? null,
          status: 'open',
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ request: data })
      }

      // ── グループの募集一覧(自店の募集＋他店の募集を応募/応募者付きで) ──
      case 'list_group_requests': {
        const { data: reqs, error } = await sb.from('shift_help_requests')
          .select('*')
          .eq('group_id', groupId)
          .neq('status', 'cancelled')
          .order('work_date', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        const requests = (reqs ?? []) as any[]
        if (requests.length === 0) return NextResponse.json({ requests: [], stores: {} })

        // 店舗名マップ
        const { data: stores } = await sb.from('stores').select('id, name').eq('group_id', groupId)
        const storeMap: Record<string, string> = {}
        for (const s of (stores ?? []) as any[]) storeMap[s.id] = s.name

        // 応募一覧(staff名付き)
        const ids = requests.map(r => r.id)
        const { data: offers } = await sb.from('shift_help_offers')
          .select('*, staff:staff(id,name,color,role)')
          .in('help_request_id', ids)
        const offersByReq: Record<string, any[]> = {}
        for (const o of (offers ?? []) as any[]) {
          ;(offersByReq[o.help_request_id] ||= []).push({ ...o, offering_store_name: storeMap[o.offering_store_id] })
        }

        const enriched = requests.map(r => ({
          ...r,
          requesting_store_name: storeMap[r.requesting_store_id],
          offers: offersByReq[r.id] ?? [],
        }))
        return NextResponse.json({ requests: enriched, stores: storeMap })
      }

      // ── 応募(応援に行く店のスタッフ) ──
      case 'offer': {
        const { help_request_id, staff_id, note } = body
        if (!help_request_id || !staff_id) {
          return NextResponse.json({ error: 'help_request_id と staff_id は必須です' }, { status: 400 })
        }
        // 募集がグループ内か検証
        const { data: hr } = await sb.from('shift_help_requests')
          .select('id, group_id, status').eq('id', help_request_id).maybeSingle()
        if (!hr || (hr as any).group_id !== groupId) {
          return NextResponse.json({ error: '対象の募集が見つかりません' }, { status: 404 })
        }
        // 重複応募チェック
        const { data: dup } = await sb.from('shift_help_offers')
          .select('id').eq('help_request_id', help_request_id).eq('staff_id', staff_id)
          .neq('status', 'declined').maybeSingle()
        if (dup) return NextResponse.json({ error: 'すでに応募済みです' }, { status: 409 })

        const { data, error } = await sb.from('shift_help_offers').insert({
          help_request_id, staff_id,
          offering_store_id: storeId,
          status: 'offered',
          note: note ?? null,
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ offer: data })
      }

      // ── 応募を確定(募集店の店長) → shifts(draft) を作成 ──
      case 'assign': {
        const { offer_id } = body
        if (!offer_id) return NextResponse.json({ error: 'offer_id は必須です' }, { status: 400 })

        const { data: offer } = await sb.from('shift_help_offers')
          .select('*').eq('id', offer_id).maybeSingle()
        if (!offer) return NextResponse.json({ error: '応募が見つかりません' }, { status: 404 })

        const { data: hr } = await sb.from('shift_help_requests')
          .select('*').eq('id', (offer as any).help_request_id).maybeSingle()
        if (!hr || (hr as any).group_id !== groupId) {
          return NextResponse.json({ error: '対象の募集が見つかりません' }, { status: 404 })
        }
        // 確定操作は募集店のみ
        if ((hr as any).requesting_store_id !== storeId) {
          return NextResponse.json({ error: '確定できるのは募集店のみです' }, { status: 403 })
        }

        const r = hr as any
        // ヘルプ勤務を shifts に作成(勤務地=募集店, home_store=応募店)
        const { data: shift, error: shiftErr } = await sb.from('shifts').insert({
          store_id: r.requesting_store_id,
          staff_id: (offer as any).staff_id,
          home_store_id: (offer as any).offering_store_id,
          work_date: r.work_date,
          start_time: r.start_time,
          end_time: r.end_time,
          position: r.position ?? null,
          status: 'draft',
          is_help: true,
          help_request_id: r.id,
          note: 'ヘルプ勤務',
        }).select().single()
        if (shiftErr) return NextResponse.json({ error: shiftErr.message }, { status: 500 })

        await sb.from('shift_help_offers').update({ status: 'assigned', shift_id: (shift as any).id }).eq('id', offer_id)

        // 充足数を判定して募集ステータス更新
        const { count: assignedCount } = await sb.from('shift_help_offers')
          .select('*', { count: 'exact', head: true })
          .eq('help_request_id', r.id).eq('status', 'assigned')
        const filled = (assignedCount ?? 0) >= (r.headcount ?? 1)
        await sb.from('shift_help_requests')
          .update({ status: filled ? 'filled' : 'partially_filled' })
          .eq('id', r.id)

        return NextResponse.json({ shift, status: filled ? 'filled' : 'partially_filled' })
      }

      // ── 応募を辞退/却下 ──
      case 'decline_offer': {
        const { offer_id } = body
        if (!offer_id) return NextResponse.json({ error: 'offer_id は必須です' }, { status: 400 })
        const { error } = await sb.from('shift_help_offers').update({ status: 'declined' }).eq('id', offer_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
      }

      // ── 募集を取消(募集店) ──
      case 'cancel': {
        const { help_request_id } = body
        if (!help_request_id) return NextResponse.json({ error: 'help_request_id は必須です' }, { status: 400 })
        const { data: hr } = await sb.from('shift_help_requests')
          .select('requesting_store_id, group_id').eq('id', help_request_id).maybeSingle()
        if (!hr || (hr as any).group_id !== groupId) {
          return NextResponse.json({ error: '対象の募集が見つかりません' }, { status: 404 })
        }
        if ((hr as any).requesting_store_id !== storeId) {
          return NextResponse.json({ error: '取消できるのは募集店のみです' }, { status: 403 })
        }
        const { error } = await sb.from('shift_help_requests').update({ status: 'cancelled' }).eq('id', help_request_id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
