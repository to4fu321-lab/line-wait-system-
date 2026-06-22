'use client'

import { Eraser, Copy, Wand2, Loader2 } from 'lucide-react'
import type { ShiftTemplate } from '@/types/shifts'
import { fmtHM } from '../_lib/time'

export type PaintValue = ShiftTemplate | 'erase' | null

// 週グリッド上部のパレット。パターンを選ぶと「塗りモード」になる。
export function ShiftPaintBar({ templates, paint, onPick, onCopyPrev, onGenerate, busy }: {
  templates: ShiftTemplate[]
  paint: PaintValue
  onPick: (p: PaintValue) => void
  onCopyPrev: () => void
  onGenerate: () => void
  busy: 'copy' | 'gen' | null
}) {
  const isErase = paint === 'erase'
  const activeId = paint && paint !== 'erase' ? paint.id : null

  return (
    <div className="mb-3 p-2.5 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-black text-gray-400">かんたんセット</span>
        <button onClick={onCopyPrev} disabled={busy !== null}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          {busy === 'copy' ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}先週をコピー
        </button>
        <button onClick={onGenerate} disabled={busy !== null}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
          {busy === 'gen' ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}希望から下書き
        </button>
      </div>

      {templates.length === 0 ? (
        <p className="text-[11px] text-gray-400">
          勤務パターンが未登録です。「設定 → 勤務パターン」から早番・遅番などを登録すると、ここから塗れます。
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {templates.map(t => {
            const active = activeId === t.id
            return (
              <button key={t.id} onClick={() => onPick(active ? null : t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  active ? 'text-white border-transparent shadow-sm' : 'text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
                style={active ? { background: t.color || '#6366f1' } : t.color ? { borderColor: t.color } : undefined}>
                {t.label} {fmtHM(t.start_time)}-{fmtHM(t.end_time)}
              </button>
            )
          })}
          <button onClick={() => onPick(isErase ? null : 'erase')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
              isErase ? 'bg-red-500 text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-red-300'
            }`}>
            <Eraser size={13} />消しゴム
          </button>
        </div>
      )}

      {paint && (
        <p className="text-[11px] text-indigo-600 font-bold mt-2">
          {isErase ? '🧽 消しゴム中：セルをタップで下書きを削除' : `🖌 「${(paint as ShiftTemplate).label}」を塗布中：空きセルをタップで即追加・スタッフ名タップで週まとめて`}
        </p>
      )}
    </div>
  )
}
