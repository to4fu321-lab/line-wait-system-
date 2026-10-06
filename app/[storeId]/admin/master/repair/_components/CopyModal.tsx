'use client'

// ============================================================================
//  コピー用モーダル（大分類 / 作業 共用, #35）
//  名前・（作業なら）コピー先の大分類・価格の一括調整を決めてコピーする。
// ============================================================================

import { useState } from 'react'
import { Copy, Loader2, X } from 'lucide-react'
import { Field } from '@/app/_components/Field'
import { RepairIcon } from '@/lib/garmentIcons'
import { REPAIR_LABELS as labels } from '@/lib/repairProfile'
import { adjustBase, type PriceAdjust } from '@/lib/repairCopy'
import type { RepairGarmentType } from '@/types/repair'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

type Mode = PriceAdjust['mode']

export function CopyModal({ kind, sourceName, samplePrice, garments, defaultGarmentId, onClose, onCopy }: {
  kind: 'garment' | 'item'
  sourceName: string
  /** プレビュー用の基本料金（作業コピー時のみ） */
  samplePrice?: number
  /** 作業コピー時のコピー先候補 */
  garments?: RepairGarmentType[]
  defaultGarmentId?: string
  onClose: () => void
  /** 失敗時は false を返すとモーダルを閉じない */
  onCopy: (v: { name: string; targetGarmentId: string | null; adjust: PriceAdjust }) => Promise<boolean>
}) {
  const [name, setName] = useState(`${sourceName}（コピー）`)
  const [target, setTarget] = useState(defaultGarmentId ?? '')
  const [mode, setMode] = useState<Mode>('none')
  const [yen, setYen] = useState('0')
  const [pct, setPct] = useState('100')
  const [withOptions, setWithOptions] = useState(true)
  const [busy, setBusy] = useState(false)

  const adjust: PriceAdjust =
    mode === 'add' ? { mode, yen: Number(yen) || 0 }
    : mode === 'pct' ? { mode, pct: Number(pct) || 0, options: withOptions }
    : { mode: 'none' }

  const submit = async () => {
    if (!name.trim() || busy) return
    if (kind === 'item' && !target) return
    setBusy(true)
    const ok = await onCopy({ name: name.trim(), targetGarmentId: kind === 'item' ? target : null, adjust })
    setBusy(false)
    if (ok) onClose()
  }

  const MODES: { key: Mode; label: string }[] = [
    { key: 'none', label: 'そのまま' },
    { key: 'add', label: '＋円' },
    { key: 'pct', label: '×%' },
  ]

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-black text-gray-900 flex items-center gap-1.5">
            <Copy size={18} />{kind === 'garment' ? labels.garment : labels.item}をコピー
          </h2>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500 leading-relaxed">
            {kind === 'garment'
              ? `「${sourceName}」の${labels.item}（基本料金）・オプション・入力欄・マニュアルをまとめて複製します。`
              : `「${sourceName}」のオプション・入力欄・マニュアルを含めて複製します。`}
          </p>

          <Field label="コピー後の名称" required>
            <input className={INPUT} value={name} onChange={e => setName(e.target.value)} />
          </Field>

          {kind === 'item' && garments && (
            <Field label={`コピー先の${labels.garment}`}>
              <div className="flex flex-wrap gap-1.5">
                {garments.map(g => (
                  <button key={g.id} type="button" onClick={() => setTarget(g.id)}
                    className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold ${
                      target === g.id ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <RepairIcon icon={g.icon} /> {g.name}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="価格の一括調整" hint="例: 学生部門→一般部門">
            <div className="flex gap-1.5">
              {MODES.map(m => (
                <button key={m.key} type="button" onClick={() => setMode(m.key)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
                    mode === m.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'add' && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-600">基本料金に</span>
                  <input type="number" inputMode="numeric" className={`${INPUT} w-28`} value={yen} onChange={e => setYen(e.target.value)} />
                  <span className="text-sm font-bold text-gray-600">円</span>
                </div>
                <p className="text-[11px] text-gray-400">マイナスで値下げ。オプションの加算額は変えません。</p>
              </div>
            )}
            {mode === 'pct' && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-600">基本料金を</span>
                  <input type="number" inputMode="decimal" className={`${INPUT} w-24`} value={pct} onChange={e => setPct(e.target.value)} />
                  <span className="text-sm font-bold text-gray-600">%に</span>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input type="checkbox" checked={withOptions} onChange={e => setWithOptions(e.target.checked)} /> オプションの加算額にも掛ける
                </label>
                <p className="text-[11px] text-gray-400">1円未満は四捨五入します。</p>
              </div>
            )}
            {mode !== 'none' && samplePrice != null && (
              <p className="mt-2 text-xs font-bold text-indigo-600">
                基本料金 ¥{samplePrice.toLocaleString()} → ¥{adjustBase(samplePrice, adjust).toLocaleString()}
              </p>
            )}
          </Field>

          <button onClick={submit} disabled={busy || !name.trim() || (kind === 'item' && !target)}
            className="w-full bg-amber-500 text-white font-black py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5">
            {busy ? <><Loader2 size={16} className="animate-spin" />コピー中…</> : <><Copy size={16} />コピーする</>}
          </button>
        </div>
      </div>
    </div>
  )
}
