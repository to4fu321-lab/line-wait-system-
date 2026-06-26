'use client'

import { useEffect, useState } from 'react'
import { Loader2, ArrowLeftRight, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift, ShiftSwap } from '@/types/shifts'
import { SWAP_STATUS_LABELS } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { fmtDateJp, fmtHM, todayJst } from '../../admin/shifts/_lib/time'

const sb = supabase as any

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/shift-swap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await res.json(); if (!res.ok) throw new Error(j.error || '通信失敗'); return j
}

export function SwapPanel({ storeId, staffId, onToast }: {
  storeId: string; staffId: string; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const today = todayJst()
  const [myShifts, setMyShifts] = useState<Shift[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [incoming, setIncoming] = useState<ShiftSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)  // 交換対象 shift_id

  const fetch = async () => {
    const [{ data: shifts }, { data: st }, { data: inc }] = await Promise.all([
      sb.from('shifts').select('*').eq('staff_id', staffId).eq('status', 'published').gte('work_date', today).order('work_date'),
      sb.from('staff').select('*').eq('store_id', storeId).eq('active', true).neq('id', staffId).order('sort_order'),
      sb.from('shift_swaps').select('*').eq('to_staff_id', staffId).eq('status', 'requested'),
    ])
    setMyShifts((shifts ?? []) as Shift[])
    setStaff((st ?? []) as Staff[])
    setIncoming((inc ?? []) as ShiftSwap[])
    setLoading(false)
  }
  useEffect(() => { fetch() }, [storeId, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  const request = async (shiftId: string, toStaffId: string) => {
    setBusy(shiftId)
    try { await api({ action: 'request', storeId, from_shift_id: shiftId, from_staff_id: staffId, to_staff_id: toStaffId }); onToast('交換を依頼しました'); setPick(null); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }
  const respond = async (swapId: string, ok: boolean) => {
    setBusy(swapId)
    try { await api({ action: ok ? 'accept' : 'reject', storeId, swap_id: swapId }); onToast(ok ? '承諾しました（店長承認待ち）' : '辞退しました'); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  return (
    <div className="space-y-5">
      {/* 自分宛の交換依頼 */}
      {incoming.length > 0 && (
        <div>
          <p className="text-xs font-black text-gray-500 mb-2">あなたへの交換依頼</p>
          <div className="space-y-2">
            {incoming.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <ArrowLeftRight size={16} className="text-amber-600" />
                <span className="text-sm text-gray-700 flex-1">交代を頼まれています</span>
                <button onClick={() => respond(s.id, false)} disabled={busy === s.id} className="p-2 rounded-lg bg-white text-gray-400 hover:text-red-500"><X size={16} /></button>
                <button onClick={() => respond(s.id, true)} disabled={busy === s.id} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center gap-1">
                  {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}受ける
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自分のシフトを交換に出す */}
      <div>
        <p className="text-xs font-black text-gray-500 mb-2">自分のシフトを交換に出す</p>
        {myShifts.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">交換できる今後の公開シフトがありません</p>
        ) : (
          <div className="space-y-2">
            {myShifts.map(sh => (
              <div key={sh.id} className="rounded-xl border border-gray-200 bg-white">
                <button onClick={() => setPick(pick === sh.id ? null : sh.id)}
                  className="w-full flex items-center gap-3 p-3 active:scale-[0.99] transition-all">
                  <span className="text-sm font-bold text-gray-900">{fmtDateJp(sh.work_date)}</span>
                  <span className="text-sm text-gray-500">{fmtHM(sh.start_time)}-{fmtHM(sh.end_time)}</span>
                  <span className="ml-auto text-xs text-indigo-600 font-bold">{pick === sh.id ? '閉じる' : '交換相手を選ぶ'}</span>
                </button>
                {pick === sh.id && (
                  <div className="px-3 pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-2">
                    {staff.map(p => (
                      <button key={p.id} onClick={() => request(sh.id, p.id)} disabled={busy === sh.id}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50">
                        {p.name}へ依頼
                      </button>
                    ))}
                    {staff.length === 0 && <span className="text-xs text-gray-400">他のスタッフがいません</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
