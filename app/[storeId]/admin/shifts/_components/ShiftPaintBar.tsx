'use client'

import { useState } from 'react'
import { Eraser, Copy, Wand2, Loader2, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShiftTemplate } from '@/types/shifts'
import { fmtHM } from '../_lib/time'

const sb = supabase as any
export type PaintValue = ShiftTemplate | 'erase' | null

const PRESET_PATTERNS = [
  { label: '早番', start_time: '10:00', end_time: '15:00', break_minutes: 0, color: '#f59e0b' },
  { label: '遅番', start_time: '14:00', end_time: '19:00', break_minutes: 0, color: '#6366f1' },
  { label: '通し', start_time: '10:00', end_time: '19:00', break_minutes: 60, color: '#10b981' },
]

// 週グリッド上部のパレット。パターンを選ぶと「塗りモード」になる。
export function ShiftPaintBar({ storeId, templates, paint, onPick, onCopyPrev, onGenerate, onTemplatesChanged, busy }: {
  storeId: string
  templates: ShiftTemplate[]
  paint: PaintValue
  onPick: (p: PaintValue) => void
  onCopyPrev: () => void
  onGenerate: () => void
  onTemplatesChanged: () => void
  busy: 'copy' | 'gen' | null
}) {
  const isErase = paint === 'erase'
  const activeId = paint && paint !== 'erase' ? paint.id : null
  const [edit, setEdit] = useState(false)
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('15:00')
  const [saving, setSaving] = useState(false)

  const addPattern = async (p: { label: string; start_time: string; end_time: string; break_minutes: number; color?: string }) => {
    setSaving(true)
    await sb.from('shift_templates').insert({
      store_id: storeId, label: p.label, start_time: p.start_time, end_time: p.end_time,
      break_minutes: p.break_minutes, color: p.color ?? '#6366f1', sort_order: templates.length, active: true,
    })
    setSaving(false); onTemplatesChanged()
  }
  const addCustom = async () => {
    if (!label.trim() || start >= end) return
    await addPattern({ label: label.trim(), start_time: start, end_time: end, break_minutes: 0 })
    setLabel('')
  }
  const removePattern = async (id: string) => {
    await sb.from('shift_templates').update({ active: false }).eq('id', id)
    if (activeId === id) onPick(null)
    onTemplatesChanged()
  }

  return (
    <div className="mb-3 p-2.5 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-black text-gray-400">かんたんセット</span>
        <button onClick={() => setEdit(v => !v)}
          className="text-[11px] font-bold text-gray-500 hover:text-indigo-600 underline decoration-dotted">
          {edit ? '完了' : 'パターン編集'}
        </button>
        <button onClick={onCopyPrev} disabled={busy !== null}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {busy === 'copy' ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}先週をコピー
        </button>
        <button onClick={onGenerate} disabled={busy !== null}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
          {busy === 'gen' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}希望から下書き
        </button>
      </div>

      {templates.length === 0 && !edit ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
          <p className="text-xs text-amber-800 font-bold mb-1.5">勤務パターンを登録すると、タップで一気にシフトを置けます</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PATTERNS.map(p => (
              <button key={p.label} onClick={() => addPattern(p)} disabled={saving}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                ＋{p.label}（{p.start_time}-{p.end_time}）
              </button>
            ))}
            <button onClick={() => setEdit(true)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-600 underline">自分で作る</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {templates.map(t => {
            const active = activeId === t.id
            return (
              <div key={t.id} className="relative">
                <button onClick={() => onPick(active ? null : t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    active ? 'text-white border-transparent shadow-sm' : 'text-gray-700 border-gray-200 hover:border-indigo-300'
                  } ${edit ? 'pr-6' : ''}`}
                  style={active ? { background: t.color || '#6366f1' } : t.color ? { borderColor: t.color } : undefined}>
                  {t.label} {fmtHM(t.start_time)}-{fmtHM(t.end_time)}
                </button>
                {edit && (
                  <button onClick={() => removePattern(t.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white grid place-items-center">
                    <X size={10} />
                  </button>
                )}
              </div>
            )
          })}
          {!edit && (
            <button onClick={() => onPick(isErase ? null : 'erase')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                isErase ? 'bg-red-500 text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-red-300'
              }`}>
              <Eraser size={13} />消しゴム
            </button>
          )}
        </div>
      )}

      {/* パターン追加フォーム */}
      {edit && (
        <div className="mt-2 flex items-end gap-2 flex-wrap">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="名称（例：中番）"
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-28" />
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-gray-400 text-sm self-center">〜</span>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={addCustom} disabled={saving || !label.trim()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}追加
          </button>
        </div>
      )}

      {paint && !edit && (
        <p className="text-[11px] text-indigo-600 font-bold mt-2">
          {isErase ? '🧽 消しゴム中：セルをタップで下書きを削除' : `🖌 「${(paint as ShiftTemplate).label}」を塗布中：空きセルをタップで即追加・スタッフ名タップで週まとめて`}
        </p>
      )}
    </div>
  )
}
