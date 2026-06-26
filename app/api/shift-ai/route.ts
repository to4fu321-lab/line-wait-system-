export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// AIシフト（両輪：割当はコードで決定的に・説明はLLM補助）
//   action=generate        … 必要人員と希望から draft シフトを自動生成
//   action=fill_candidates  … 欠員に対する補充候補をスコア順に抽出
// 再現性のため割当ロジックはルールベース。LLMは将来 説明文付与に使用。
// ============================================================
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}
type SB = ReturnType<typeof getSupabase>

const FITTING_TYPES = ['uniform', 'jersey', 'fitting']
function isFitting(purpose: string | null, st: string | null): boolean {
  if (st && FITTING_TYPES.includes(st)) return true
  if (purpose && purpose.includes('採寸')) return true
  return false
}
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// その日の時間帯別 必要人員（client demand.ts と同じ式）
async function computeRequirements(sb: SB, storeId: string, date: string) {
  const [{ data: store }, { data: rs }, { data: resv }, { data: st }] = await Promise.all([
    sb.from('stores').select('active_fittings').eq('id', storeId).maybeSingle(),
    sb.from('reservation_settings').select('duration_min, start_time, end_time, is_active').eq('store_id', storeId).eq('is_active', true),
    sb.from('reservations').select('reserved_at, purpose, service_type, status').eq('store_id', storeId)
      .gte('reserved_at', `${date}T00:00:00+09:00`).lte('reserved_at', `${date}T23:59:59+09:00`).neq('status', 'cancelled'),
    sb.from('staffing_settings').select('*').eq('store_id', storeId).maybeSingle(),
  ])
  const s = (st as any) ?? {}
  const cfg = {
    time_block_min: s.time_block_min ?? 60, min_staff: s.min_staff ?? 1, max_staff: s.max_staff ?? 12,
    fitting_minutes: s.fitting_minutes ?? 20, per_person_rooms: Number(s.per_person_rooms ?? 1.5),
    conversion_rate: Number(s.conversion_rate ?? 0.6), visit_factor: Number(s.visit_factor ?? 1.2),
  }
  const rooms = Number((store as any)?.active_fittings ?? 4) || 4
  const services = (rs ?? []) as any[]
  if (services.length) cfg.fitting_minutes = Math.min(...services.map(x => x.duration_min))
  let startMin = 10 * 60, endMin = 19 * 60
  if (services.length) { startMin = Math.min(...services.map(x => toMin(x.start_time))); endMin = Math.max(...services.map(x => toMin(x.end_time))) }

  const counts: Record<number, number> = {}
  for (const r of (resv ?? []) as any[]) {
    if (!isFitting(r.purpose, r.service_type)) continue
    const d = new Date(new Date(r.reserved_at).getTime() + 9 * 3600000)
    const min = d.getUTCHours() * 60 + d.getUTCMinutes()
    const block = Math.floor(min / cfg.time_block_min) * cfg.time_block_min
    counts[block] = (counts[block] ?? 0) + 1
  }
  const blocks: { start: number; reservations: number; required: number }[] = []
  for (let m = Math.floor(startMin / cfg.time_block_min) * cfg.time_block_min; m < endMin; m += cfg.time_block_min) {
    const rv = counts[m] ?? 0
    let required = 0
    if (rv > 0) {
      const concurrent = Math.min(rooms, rv * cfg.visit_factor * (cfg.fitting_minutes / cfg.time_block_min))
      const conversionExtra = rv * cfg.visit_factor * cfg.conversion_rate * (cfg.fitting_minutes / cfg.time_block_min) * 0.3
      required = Math.max(cfg.min_staff, Math.min(cfg.max_staff, Math.ceil(concurrent / cfg.per_person_rooms + conversionExtra)))
    }
    blocks.push({ start: m, reservations: rv, required })
  }
  return { blocks, startMin, endMin }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, storeId, date } = body
    if (!action || !storeId || !date) return NextResponse.json({ ok: false, error: 'action/storeId/date は必須' }, { status: 400 })
    const sb = getSupabase()

    const { blocks, startMin, endMin } = await computeRequirements(sb, storeId, date)
    const peak = blocks.reduce((a, b) => Math.max(a, b.required), 0)

    // staffing_requirements に保存（人員設計の参考値）
    for (const b of blocks) {
      await sb.from('staffing_requirements').upsert({
        store_id: storeId, work_date: date, time_block: hhmm(b.start),
        required: b.required, reservations: b.reservations, source: 'demand',
      }, { onConflict: 'store_id,work_date,time_block' })
    }

    if (action === 'fill_candidates') {
      const candidates = await rankCandidates(sb, storeId, date)
      return NextResponse.json({ ok: true, peak, candidates })
    }

    if (action === 'generate') {
      // 既存の当日シフト（重複生成を避ける）
      const { data: existing } = await sb.from('shifts').select('staff_id').eq('store_id', storeId).eq('work_date', date).neq('status', 'cancelled')
      const taken = new Set((existing ?? []).map((s: any) => s.staff_id))

      // 希望提出者（work）＋スタッフ属性
      const { data: reqs } = await sb.from('shift_requests')
        .select('staff_id, pref_start, pref_end, kind, staff:staff(id,name,hourly_wage,max_daily_hours,skill_level)')
        .eq('store_id', storeId).eq('work_date', date).eq('kind', 'work').in('status', ['submitted', 'approved'])
      // 休み希望(approved)は除外
      const { data: offs } = await sb.from('shift_requests').select('staff_id').eq('store_id', storeId).eq('work_date', date).eq('kind', 'off')
      const offSet = new Set((offs ?? []).map((o: any) => o.staff_id))

      let pool = ((reqs ?? []) as any[])
        .filter(r => !taken.has(r.staff_id) && !offSet.has(r.staff_id))
        .map(r => ({
          staff_id: r.staff_id,
          wage: r.staff?.hourly_wage ?? 99999,
          start: r.pref_start ? toMin(r.pref_start) : startMin,
          end: r.pref_end ? toMin(r.pref_end) : endMin,
        }))
      // 安い時給優先（予算配慮）→ スキル高い順は同点時
      pool.sort((a, b) => a.wage - b.wage)

      const need = peak
      const chosen = pool.slice(0, need)
      let created = 0
      for (const c of chosen) {
        const { error } = await sb.from('shifts').insert({
          store_id: storeId, staff_id: c.staff_id, home_store_id: storeId, work_date: date,
          start_time: hhmm(Math.max(startMin, Math.min(c.start, endMin - 60))),
          end_time: hhmm(Math.min(endMin, Math.max(c.end, startMin + 60))),
          break_minutes: 60, status: 'draft', note: 'AI自動生成',
        })
        if (!error) created++
      }
      const shortage = Math.max(0, need - created)
      return NextResponse.json({ ok: true, peak, created, shortage })
    }

    return NextResponse.json({ ok: false, error: `未対応のaction: ${action}` }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// 欠員補充候補をスコア順に（出勤可・スキル・通勤・過去協力度）
async function rankCandidates(sb: SB, storeId: string, date: string) {
  const { data: staff } = await sb.from('staff').select('id,name,color,skill_level,commute_min,role')
    .eq('store_id', storeId).eq('active', true)
  // その日すでに勤務 or 休み希望は除外
  const { data: dayShifts } = await sb.from('shifts').select('staff_id').eq('store_id', storeId).eq('work_date', date).neq('status', 'cancelled')
  const { data: offs } = await sb.from('shift_requests').select('staff_id').eq('store_id', storeId).eq('work_date', date).eq('kind', 'off')
  const busy = new Set([...(dayShifts ?? []).map((s: any) => s.staff_id), ...(offs ?? []).map((o: any) => o.staff_id)])

  // 過去協力度 = 過去のヘルプ応募回数
  const { data: offers } = await sb.from('shift_help_offers').select('staff_id')
  const coop: Record<string, number> = {}
  for (const o of (offers ?? []) as any[]) coop[o.staff_id] = (coop[o.staff_id] ?? 0) + 1

  // 勤務可の希望を出している人は加点
  const { data: wantWork } = await sb.from('shift_requests').select('staff_id').eq('store_id', storeId).eq('work_date', date).eq('kind', 'work')
  const wants = new Set((wantWork ?? []).map((w: any) => w.staff_id))

  return ((staff ?? []) as any[])
    .filter(s => !busy.has(s.id))
    .map(s => {
      const score = (s.skill_level ?? 1) * 2
        + (wants.has(s.id) ? 5 : 0)
        + (coop[s.id] ?? 0)
        - (s.commute_min ?? 0) / 30
      return { staff_id: s.id, name: s.name, color: s.color, score: Math.round(score * 10) / 10, wants_work: wants.has(s.id) }
    })
    .sort((a, b) => b.score - a.score)
}
