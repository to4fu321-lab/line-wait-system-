'use client'

// ============================================================================
//  「受付で聞くこと」（FieldDef[]）の編集
//
//  これまで作業モーダルには
//    ・プリセット由来の fields  … 表示のみ・編集不可
//    ・旧 measurements のエディタ … ラベルと単位を手打ちする旧方式
//  が並んでいて、新規に作った作業は旧方式しか使えなかった。
//  どちらも fields に一本化し、種類（数値/選択肢/はい・いいえ/自由入力）を
//  選ぶだけで受付画面の入力欄ができるようにする。
// ============================================================================

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check } from 'lucide-react'
import { FIELD_RANGE_PRESETS } from '@/lib/repairPresets'
import { useLongPressReorder } from '@/lib/useLongPressReorder'
import type { FieldDef, FieldType, FieldChoice } from '@/types/repair'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// 画面から選べる種類。material（商品から選ぶ）はプリセット専用なので出さない。
const PICKABLE: { type: FieldType; label: string; hint: string }[] = [
  { type: 'number', label: '数値',       hint: '股下・ポンド数など。スワイプで選ぶ' },
  { type: 'select', label: '選択肢',     hint: '決まった中から1つ選ぶ' },
  { type: 'bool',   label: 'はい / いいえ', hint: '持ち込みあり など' },
  { type: 'text',   label: '自由入力',   hint: 'メモ・機種名など' },
]

/** 一覧に出す1行のまとめ（例: 50〜100cm / 股下・総丈） */
export function fieldSummary(f: FieldDef): string {
  switch (f.type ?? 'text') {
    case 'number':   return `${f.min ?? ''}〜${f.max ?? ''}${f.unit ?? ''}`
    case 'select':   return (f.choices ?? []).map(c => c.label).join('・')
    case 'bool':     return 'はい / いいえ'
    case 'material': return '商品マスタから選ぶ'
    default:         return f.suggest_choices?.length ? `候補${f.suggest_choices.length}件` : '自由入力'
  }
}

const blank = (): FieldDef => ({
  key: `f_${Date.now().toString(36)}`,
  label: '', type: 'number', unit: 'cm', min: 1, max: 10, step: 1,
})

export function FieldsEditor({ value, onChange }: {
  value:    FieldDef[]
  onChange: (fields: FieldDef[]) => void
}) {
  // 編集中の1件。null = 一覧のみ
  const [draft, setDraft] = useState<FieldDef | null>(null)
  const [isNew, setIsNew] = useState(false)

  const drag = useLongPressReorder(
    value.map(f => ({ ...f, id: f.key })),
    next => onChange(next.map(({ id: _id, ...f }) => f as FieldDef)),
  )

  const commit = () => {
    if (!draft) return
    const label = draft.label.trim()
    if (!label) return
    const f: FieldDef = { ...draft, label }
    // 数値は中央を初期位置にする。現場が近い値から動かせる
    if (f.type === 'number' && f.min != null && f.max != null) {
      const step = f.step && f.step > 0 ? f.step : 1
      f.default = Math.round(((f.min + f.max) / 2) / step) * step
    }
    onChange(isNew ? [...value, f] : value.map(x => x.key === f.key ? f : x))
    setDraft(null)
  }

  const patch = (p: Partial<FieldDef>) => setDraft(d => d ? { ...d, ...p } : d)

  // 種類を変えたら、その種類に要らない設定は落とす（残っていると誤動作する）
  const changeType = (type: FieldType) => setDraft(d => {
    if (!d) return d
    const base: FieldDef = { key: d.key, label: d.label, type, required: d.required, show_if: d.show_if }
    if (type === 'number') return { ...base, unit: d.unit ?? 'cm', min: d.min ?? 1, max: d.max ?? 10, step: d.step ?? 1 }
    if (type === 'select') return { ...base, choices: d.choices ?? [], allow_free: d.allow_free }
    if (type === 'text')   return { ...base, suggest_choices: d.suggest_choices }
    return base
  })

  // 1行1つ。既存の選択肢は加算額を持っていることがあるので、名前で拾い直す
  const parseChoices = (text: string, prev: FieldChoice[] = []): FieldChoice[] =>
    text.split('\n').map(s => s.trim()).filter(Boolean).map(label => {
      const old = prev.find(c => c.label === label)
      return old ?? { value: label, label }
    })

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">
          受付で聞くこと
          <span className="ml-1.5 text-[11px] font-normal text-gray-400">長押しで並べ替え</span>
        </span>
        {!draft && (
          <button type="button" onClick={() => { setDraft(blank()); setIsNew(true) }}
            className="text-indigo-600 text-xs font-bold flex items-center gap-1"><Plus size={13} />追加</button>
        )}
      </div>

      {value.length === 0 && !draft && (
        <p className="text-xs text-gray-400 py-1">なし（作業名と金額だけで受け付けます）</p>
      )}

      <div className="space-y-1.5">
        {drag.order.map(f => (
          <div key={f.key} {...drag.bind(f.key)} style={{ WebkitTouchCallout: 'none' }}
            className={`flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 select-none touch-manipulation transition-all
              ${drag.dragId === f.key ? 'ring-2 ring-amber-400 bg-white shadow' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-gray-800">{f.label}</span>
                <span className="rounded bg-white border border-indigo-200 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                  {PICKABLE.find(p => p.type === (f.type ?? 'text'))?.label ?? '商品から選ぶ'}
                </span>
                {f.required && <span className="text-[10px] text-red-500 font-bold">必須</span>}
              </div>
              <p className="text-[11px] text-gray-400 truncate">{fieldSummary(f)}</p>
            </div>
            <button type="button" onClick={() => { if (drag.ignoreClick()) return; setDraft({ ...f }); setIsNew(false) }}
              className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={13} /></button>
            <button type="button" onClick={() => { if (drag.ignoreClick()) return; onChange(value.filter(x => x.key !== f.key)) }}
              className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="border-2 border-indigo-200 bg-indigo-50/40 rounded-xl p-3 space-y-3">
          <input className={INPUT} value={draft.label} autoFocus
            onChange={e => patch({ label: e.target.value })}
            placeholder="見出し（例: 股下 / ポンド数 / 糸の色）" />

          {draft.type === 'material' ? (
            <p className="text-[11px] text-gray-500">この欄は商品マスタから選ぶ設定です。見出しと必須のみ変更できます。</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {PICKABLE.map(p => (
                <button key={p.type} type="button" onClick={() => changeType(p.type)}
                  className={`rounded-lg border-2 px-2.5 py-1.5 text-left transition ${
                    (draft.type ?? 'text') === p.type ? 'border-indigo-400 bg-white' : 'border-transparent bg-white/60'
                  }`}>
                  <span className="block text-xs font-black text-gray-800">{p.label}</span>
                  <span className="block text-[10px] text-gray-500 leading-tight">{p.hint}</span>
                </button>
              ))}
            </div>
          )}

          {draft.type === 'number' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {FIELD_RANGE_PRESETS.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => patch({ min: p.min, max: p.max, step: p.step, unit: p.unit })}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-indigo-200 text-indigo-600 bg-white active:scale-95">
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([['最小', 'min'], ['最大', 'max'], ['刻み', 'step']] as const).map(([lbl, k]) => (
                  <label key={k} className="block">
                    <span className="block text-[11px] font-bold text-gray-600 mb-0.5">{lbl}</span>
                    <input type="number" inputMode="decimal" className={INPUT}
                      value={draft[k] ?? ''} onChange={e => patch({ [k]: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </label>
                ))}
                <label className="block">
                  <span className="block text-[11px] font-bold text-gray-600 mb-0.5">単位</span>
                  <input className={INPUT} value={draft.unit ?? ''} onChange={e => patch({ unit: e.target.value })} />
                </label>
              </div>
              <p className="text-[11px] text-gray-500">
                受付では中央あたりからスワイプして選びます。範囲外は自由入力できます。
              </p>
            </>
          )}

          {draft.type === 'select' && (
            <>
              <label className="block">
                <span className="block text-[11px] font-bold text-gray-600 mb-0.5">選択肢（1行に1つ）</span>
                <textarea className={INPUT + ' h-24'} value={(draft.choices ?? []).map(c => c.label).join('\n')}
                  onChange={e => patch({ choices: parseChoices(e.target.value, draft.choices) })}
                  placeholder={'シングル\nダブル'} />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                <input type="checkbox" checked={!!draft.allow_free} onChange={e => patch({ allow_free: e.target.checked })} />
                「その他」で手入力も許す
              </label>
            </>
          )}

          {draft.type === 'text' && (
            <label className="block">
              <span className="block text-[11px] font-bold text-gray-600 mb-0.5">
                候補<span className="ml-1 font-normal text-gray-400">1行に1つ・任意。タップで入力できます</span>
              </span>
              <textarea className={INPUT + ' h-20'} value={(draft.suggest_choices ?? []).join('\n')}
                onChange={e => patch({ suggest_choices: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                placeholder={'ヨネックス\nミズノ'} />
            </label>
          )}

          <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
            <input type="checkbox" checked={!!draft.required} onChange={e => patch({ required: e.target.checked })} />
            必須（入れないと次へ進めない）
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={() => setDraft(null)}
              className="flex-1 rounded-xl border border-gray-300 bg-white py-2 text-sm font-bold text-gray-600">やめる</button>
            <button type="button" onClick={commit} disabled={!draft.label.trim()}
              className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-black text-white disabled:opacity-40 flex items-center justify-center gap-1">
              <Check size={15} />{isNew ? '追加' : '更新'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
