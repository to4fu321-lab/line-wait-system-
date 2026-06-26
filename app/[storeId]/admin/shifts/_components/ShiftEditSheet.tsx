'use client'

import { useEffect, useState } from 'react'
import { X, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Shift, ShiftTemplate } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { fmtDateJp, fmtHM } from '../_lib/time'

const sb = supabase as any
const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

export function ShiftEditSheet({
  storeId, staff, templates, date, editing, defaultStaffId, onClose, onSaved, onToast,
}: {
  storeId: string
  staff: Staff[]
  templates: ShiftTemplate[]
  date: string                 // YYYY-MM-DD（新規作成の初期日）
  editing: Shift | null        // 編集対象（null=新規）
  defaultStaffId?: string
  onClose: () => void
  onSaved: () => void
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [staffId, setStaffId]   = useState(editing?.staff_id ?? defaultStaffId ?? staff[0]?.id ?? '')
  const [workDate, setWorkDate] = useState(editing?.work_date ?? date)
  const [start, setStart]       = useState(fmtHM(editing?.start_time ?? '10:00'))
  const [end, setEnd]           = useState(fmtHM(editing?.end_time ?? '18:00'))
  const [breakMin, setBreakMin] = useState(editing?.break_minutes ?? 60)
  const [position, setPosition] = useState(editing?.position ?? '')
  const [wage, setWage]         = useState<string>(editing?.hourly_wage != null ? String(editing.hourly_wage) : '')
  const [note, setNote]         = useState(editing?.note ?? '')
  const [saving, setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const isHelp = !!editing?.is_help

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const applyTemplate = (t: ShiftTemplate) => {
    setStart(fmtHM(t.start_time)); setEnd(fmtHM(t.end_time)); setBreakMin(t.break_minutes)
  }

  const save = async () => {
    if (!staffId) { onToast('スタッフを選んでください', 'err'); return }
    if (start >= end) { onToast('終了は開始より後にしてください', 'err'); return }
    setSaving(true)
    const payload = {
      store_id: storeId,
      staff_id: staffId,
      home_store_id: storeId,
      work_date: workDate,
      start_time: start,
      end_time: end,
      break_minutes: breakMin,
      position: position.trim() || null,
      hourly_wage: wage.trim() ? Number(wage) : null,
      note: note.trim() || null,
    }
    if (editing) {
      const { error } = await sb.from('shifts').update(payload).eq('id', editing.id)
      setSaving(false)
      if (error) { onToast('保存に失敗しました', 'err'); return }
      onToast('シフトを更新しました'); onSaved(); onClose()
    } else {
      const { error } = await sb.from('shifts').insert({ ...payload, status: 'draft' })
      setSaving(false)
      if (error) { onToast('登録に失敗しました', 'err'); return }
      onToast('シフトを追加しました'); onSaved(); onClose()
    }
  }

  const del = async () => {
    if (!editing) return
    setSaving(true)
    const { error } = await sb.from('shifts').delete().eq('id', editing.id)
    setSaving(false)
    if (error) { onToast('削除に失敗しました', 'err'); return }
    onToast('シフトを削除しました'); onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-gray-900">{editing ? 'シフトを編集' : 'シフトを追加'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {isHelp && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-700 font-bold">
              🤝 他店からのヘルプ勤務です（割当はヘルプタブで管理）
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">スタッフ</label>
            <select className={INPUT} value={staffId} onChange={e => setStaffId(e.target.value)} disabled={isHelp}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.role ? `（${s.role}）` : ''}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">日付</label>
            <input type="date" className={INPUT} value={workDate} onChange={e => setWorkDate(e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">{fmtDateJp(workDate)}</p>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">パターン</label>
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 transition-all"
                    style={t.color ? { borderColor: t.color } : undefined}>
                    {t.label} {fmtHM(t.start_time)}-{fmtHM(t.end_time)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">開始</label>
              <input type="time" className={INPUT} value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">終了</label>
              <input type="time" className={INPUT} value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">休憩（分）</label>
              <input type="number" min={0} step={15} className={INPUT} value={breakMin} onChange={e => setBreakMin(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">時給（任意・上書き）</label>
              <input type="number" min={0} step={10} className={INPUT} placeholder="既定を使用" value={wage} onChange={e => setWage(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">ポジション（任意）</label>
            <input className={INPUT} placeholder="レジ / 採寸 / フロア など" value={position} onChange={e => setPosition(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">メモ（任意）</label>
            <input className={INPUT} value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-3">
          {editing && !isHelp && (
            confirmDel ? (
              <button onClick={del} disabled={saving}
                className="px-3 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black active:scale-95 transition-all flex items-center gap-1">
                <Trash2 size={16} />本当に削除
              </button>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                className="p-2.5 rounded-xl bg-gray-100 text-red-600 hover:bg-red-50 active:scale-95 transition-all">
                <Trash2 size={18} />
              </button>
            )
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-black active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : (editing ? '更新する' : '追加する')}
          </button>
        </div>
      </div>
    </div>
  )
}
