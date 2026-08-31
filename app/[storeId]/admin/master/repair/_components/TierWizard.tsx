'use client'

// ============================================================================
//  「段階で金額が変わる選択肢」を作るウィザード
//
//  旧画面は 最小/最大/刻み/単位/表示形式/金額の付け方 を一度に並べていた。
//  用語が抽象的なうえ、文字数を作ろうとしているのに「〜5cm」のクイック範囲が
//  出るなど、何を触ればよいか分からない状態だった。
//
//  ここでは1画面1問にして、日本語の質問に順に答えれば出来上がるようにする。
//    1. 何の段階か   → 単位と見出しが決まる
//    2. いくつからいくつまで
//    3. 表示のしかた（〜5文字 / 5文字）… その場の数字で実例を見せる
//    4. 金額の付け方 → プレビューを見て作成
// ============================================================================

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildTiers } from '@/lib/repairPresets'
import { NumberSwipePicker } from '@/app/[storeId]/admin/repairs/_components/NumberSwipePicker'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// よくある段階。ここを選ぶと単位・見出し・範囲がまとめて決まる
const KINDS = [
  { id: 'text',   label: '文字数',   desc: 'ネーム刺繍など', unit: '文字', group: '文字数', min: 3, max: 10, step: 1, pickMax: 20 },
  { id: 'length', label: '長さ',     desc: '詰め幅・出し幅など', unit: 'cm', group: '詰め幅', min: 1, max: 10, step: 1, pickMax: 50 },
  { id: 'free',   label: 'そのほか', desc: '単位も自分で決める', unit: '',   group: '',      min: 1, max: 5,  step: 1, pickMax: 50 },
] as const

type KindId = typeof KINDS[number]['id']

const STEP_CHOICES = [1, 2, 5, 10]

export function TierWizard({ storeId, itemId, startSort, onClose, onDone, onError }: {
  storeId:   string
  itemId:    string
  /** 追加する段階の sort_order 開始位置（既存の最後の次） */
  startSort: number
  onClose:   () => void
  onDone:    (added: number) => void
  onError:   (msg: string) => void
}) {
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<KindId>('text')
  const [group, setGroup] = useState('文字数')
  const [unit, setUnit]   = useState('文字')
  const [min, setMin]     = useState('3')
  const [max, setMax]     = useState('10')
  const [gap, setGap]     = useState('1')
  const [labelStyle, setLabelStyle] = useState<'upto' | 'exact'>('upto')
  const [varies, setVaries]   = useState(false)
  const [baseAdd, setBaseAdd] = useState('0')
  const [stepAdd, setStepAdd] = useState('100')
  const [saving, setSaving]   = useState(false)

  const kindDef = KINDS.find(k => k.id === kind)!
  const nMin = Number(min), nMax = Number(max), nGap = Number(gap)

  const tiers = buildTiers({
    min: nMin, max: nMax, step: nGap, unit,
    labelStyle,
    baseAdd: varies ? Number(baseAdd) || 0 : 0,
    stepAdd: varies ? Number(stepAdd) || 0 : 0,
  })

  const pickKind = (k: typeof KINDS[number]) => {
    setKind(k.id); setUnit(k.unit); setGroup(k.group)
    setMin(String(k.min)); setMax(String(k.max)); setGap(String(k.step))
  }

  // 各ステップで「次へ」を押せる条件
  const canNext =
    step === 1 ? group.trim().length > 0 && (kind !== 'free' || unit.trim().length > 0) :
    step === 2 ? tiers.length > 0 && tiers.length <= 50 :
    true

  const create = async () => {
    if (tiers.length === 0) return onError('範囲を確認してください')
    setSaving(true)
    let sort = startSort
    const payload = tiers.map((t, i) => ({
      store_id: storeId, item_id: itemId,
      group_label: group.trim(), group_select: 'single' as const,
      code: `o_${Date.now().toString(36)}_${i}`,
      name: t.name, price_delta: t.delta, price_unit: 'per_item' as const,
      default_selected: varies && i === 0,   // 増分方式は先頭＝基本料金内なので初期選択
      requires_quote: false, manual: null,
      sort_order: (sort += 10),
    }))
    const { error } = await (supabase as any).from('repair_options').insert(payload)
    setSaving(false)
    if (error) return onError(`作成に失敗しました: ${error.message}`)
    onDone(payload.length)
  }

  const TOTAL = 4
  const titles = ['何の段階を作りますか？', 'いくつからいくつまで？', '見え方を選んでください', '金額の付け方']

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3.5 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-indigo-500">ステップ {step} / {TOTAL}</p>
              <h2 className="font-black text-gray-900">{titles[step - 1]}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
          </div>
          <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* ── 1. 何の段階か ── */}
          {step === 1 && (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                選んだ数に応じて<strong>金額が変わる</strong>ものを作ります。
                金額が変わらない数値（股下・ポンド数など）は、作業の編集画面「受付で聞くこと」から追加してください。
              </p>
              <div className="space-y-2">
                {KINDS.map(k => (
                  <button key={k.id} type="button" onClick={() => pickKind(k)}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                      kind === k.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}>
                    <span className="block text-sm font-black text-gray-800">{k.label}</span>
                    <span className="block text-[11px] text-gray-500">{k.desc}</span>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="block text-xs font-bold text-gray-600 mb-1">
                  見出し<span className="text-red-500">*</span>
                  <span className="ml-1 font-normal text-gray-400">受付画面でこの名前が出ます</span>
                </span>
                <input className={INPUT} value={group} onChange={e => setGroup(e.target.value)}
                  placeholder="例: 文字数" />
              </label>
              {kind === 'free' && (
                <label className="block">
                  <span className="block text-xs font-bold text-gray-600 mb-1">
                    単位<span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-gray-400">数のうしろに付きます</span>
                  </span>
                  <input className={INPUT} value={unit} onChange={e => setUnit(e.target.value)}
                    placeholder="例: 個 / 枚 / cm" />
                </label>
              )}
            </>
          )}

          {/* ── 2. 範囲 ── */}
          {step === 2 && (
            <>
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">いちばん小さい数</p>
                <NumberSwipePicker value={min} onChange={setMin} min={1} max={kindDef.pickMax} step={1} unit={unit} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">いちばん大きい数</p>
                <NumberSwipePicker value={max} onChange={setMax} min={1} max={kindDef.pickMax} step={1} unit={unit} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-600 mb-1">
                  いくつ刻み？<span className="ml-1 font-normal text-gray-400">段階の細かさ</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {STEP_CHOICES.map(s => (
                    <button key={s} type="button" onClick={() => setGap(String(s))}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
                        nGap === s ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                      }`}>{s}{unit}ずつ</button>
                  ))}
                </div>
              </div>
              <p className={`text-xs font-bold ${tiers.length === 0 || tiers.length > 50 ? 'text-red-500' : 'text-gray-500'}`}>
                {tiers.length === 0 ? 'いちばん大きい数を、小さい数以上にしてください'
                  : tiers.length > 50 ? `段階が多すぎます（${tiers.length}件）。刻みを大きくしてください`
                  : `${tiers.length}段階になります`}
              </p>
            </>
          )}

          {/* ── 3. 表示のしかた ── */}
          {step === 3 && (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                受付画面に出る文字を選びます。実際の数字で見比べてください。
              </p>
              {([
                { v: 'upto'  as const, title: '「まで」で表す', desc: `${nMin}${unit}までは同じ料金、というとき` },
                { v: 'exact' as const, title: 'ぴったりで表す', desc: 'その数ちょうどを選ぶとき' },
              ]).map(o => (
                <button key={o.v} type="button" onClick={() => setLabelStyle(o.v)}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                    labelStyle === o.v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}>
                  <span className="block text-sm font-black text-gray-800">{o.title}</span>
                  <span className="block text-[11px] text-gray-500 mb-1.5">{o.desc}</span>
                  <span className="flex flex-wrap gap-1">
                    {buildTiers({ min: nMin, max: nMax, step: nGap, unit, labelStyle: o.v, baseAdd: 0, stepAdd: 0 })
                      .slice(0, 3).map(t => (
                        <span key={t.name} className="rounded-md bg-white border border-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-700">{t.name}</span>
                      ))}
                    <span className="text-[11px] text-gray-400 self-center">…</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {/* ── 4. 金額 ── */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <button type="button" onClick={() => setVaries(false)}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                    !varies ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}>
                  <span className="block text-sm font-black text-gray-800">どれを選んでも同じ料金</span>
                  <span className="block text-[11px] text-gray-500">記録だけ残したいとき</span>
                </button>
                <button type="button" onClick={() => setVaries(true)}
                  className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
                    varies ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}>
                  <span className="block text-sm font-black text-gray-800">段階で料金が上がる</span>
                  <span className="block text-[11px] text-gray-500">1段ふえるごとに加算する</span>
                </button>
              </div>

              {varies && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                  <label className="block">
                    <span className="block text-xs font-bold text-gray-600 mb-1">
                      1段ふえるごとに<span className="ml-1 font-normal text-gray-400">円</span>
                    </span>
                    <input type="number" inputMode="numeric" className={INPUT} value={stepAdd}
                      onChange={e => setStepAdd(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-bold text-gray-600 mb-1">
                      いちばん小さい段階の上乗せ
                      <span className="ml-1 font-normal text-gray-400">ふつうは0円（基本料金に含む）</span>
                    </span>
                    <input type="number" inputMode="numeric" className={INPUT} value={baseAdd}
                      onChange={e => setBaseAdd(e.target.value)} />
                  </label>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500 mb-2">
                  「{group.trim() || '（見出し）'}」— {tiers.length}件できます
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tiers.map(t => (
                    <span key={t.name} className="inline-flex items-center gap-1 bg-white border-2 border-indigo-200 rounded-lg px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {t.name}
                      {t.delta !== 0 && <span className="text-gray-400">{t.delta > 0 ? '+' : ''}¥{t.delta.toLocaleString()}</span>}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  受付時の金額 = 基本料金{varies ? ' + 選んだ段階の加算' : ''}。作成後も1つずつ直せます。
                </p>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-2">
          <button type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)}
            className="flex items-center justify-center gap-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-600">
            <ChevronLeft size={16} />{step === 1 ? 'やめる' : '戻る'}
          </button>
          {step < TOTAL ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}
              className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white disabled:opacity-40">
              次へ<ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={create} disabled={saving || tiers.length === 0}
              className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white disabled:opacity-40">
              {saving ? <><Loader2 size={16} className="animate-spin" />作成中…</> : <><Check size={16} />この内容で作る</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
