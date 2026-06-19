'use client'

// ============================================================
// 予約受付ウィザード（受付トークを画面化）
//   ①お客様 → ②来店内容 → ③日時 → ④確認
//   どのステップからでも操作可。採寸系のみ試着室(枠)を消費。
// ============================================================
import { useEffect, useState } from 'react'
import { Loader2, Check, X, ChevronLeft, ChevronRight, User, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { CustomerLinkSheet } from '../../repairs/_components/CustomerLinkSheet'
import type { CustResult } from '../../repairs/_components/types'
import { INFO_PURPOSES, type InfoPurpose } from '../_lib/purposes'
import { computeSlotInfo, loadServices, type SlotInfo, type ResvService } from '../_lib/slots'

type Child = { id: string; name: string; school_name: string | null }
type StepKey = 'customer' | 'purpose' | 'datetime' | 'confirm'

// 来店内容の統一選択型：採寸(試着室を使う) or 情報のみ
type Choice =
  | { kind: 'fitting'; service: ResvService }
  | { kind: 'info'; info: InfoPurpose }

function choiceLabel(c: Choice | null): string | null {
  if (!c) return null
  return c.kind === 'fitting' ? c.service.label : c.info.label
}

function todayJst(): string { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10) }
function addDays(d: string, n: number): string { const x = new Date(d + 'T12:00:00Z'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) }
function fmtDate(d: string): string { const x = new Date(d + 'T12:00:00Z'); const w = ['日', '月', '火', '水', '木', '金', '土']; return `${x.getUTCMonth() + 1}/${x.getUTCDate()}（${w[x.getUTCDay()]}）` }

const STEPS: { key: StepKey; n: number; title: string }[] = [
  { key: 'customer', n: 1, title: 'お客様' },
  { key: 'purpose',  n: 2, title: '来店内容' },
  { key: 'datetime', n: 3, title: '日時' },
  { key: 'confirm',  n: 4, title: '確認' },
]

export function ReservationWizard({ storeId, onSaved, onCancel }: {
  storeId: string; onSaved: () => void; onCancel: () => void
}) {
  const [step, setStep] = useState<StepKey>('customer')
  const [cust, setCust] = useState<CustResult | null>(null)
  const [child, setChild] = useState<Child | null>(null)
  const [customerName, setCustomerName] = useState('')   // 未登録客の氏名のみ受付
  const [sheetOpen, setSheetOpen] = useState(false)
  const [choice, setChoice] = useState<Choice | null>(null)
  const [date, setDate] = useState(todayJst())
  const [time, setTime] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [services, setServices] = useState<ResvService[]>([])
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [slotState, setSlotState] = useState<'idle' | 'loading' | 'closed' | 'nosettings' | 'ok'>('idle')

  const usesFitting = choice?.kind === 'fitting'

  // 採寸（試着室を使う）メニューを reservation_settings から取得
  useEffect(() => {
    let cancelled = false
    loadServices(storeId).then(s => { if (!cancelled) setServices(s) })
    return () => { cancelled = true }
  }, [storeId])

  // 採寸系のとき、日付・サービスに応じて空き枠を取得
  useEffect(() => {
    if (step !== 'datetime' || !choice || choice.kind !== 'fitting') return
    const service = choice.service
    let cancelled = false
    setSlotState('loading'); setSlots([]); setTime(null)
    computeSlotInfo(storeId, date, service).then(r => {
      if (cancelled) return
      if (!r.hasSettings) { setSlotState('nosettings'); return }
      if (r.dayClosed) { setSlotState('closed'); return }
      setSlots(r.slots); setSlotState('ok')
    })
    return () => { cancelled = true }
  }, [step, choice, date, storeId])

  const hasIdentity = !!cust || !!customerName.trim()   // 顧客紐付け or 氏名入力が必須
  const donePurpose = !!choice
  const doneDatetime = !!time
  const canConfirm = hasIdentity && donePurpose && doneDatetime

  const save = async () => {
    if (!hasIdentity) { setError('お客様（氏名）を入力してください'); return }
    if (!choice || !time) { setError('来店内容と日時を選んでください'); return }
    setSaving(true); setError(null)
    const { error: err } = await (supabase.from('reservations') as any).insert({
      store_id: storeId,
      customer_id: cust?.id ?? null,
      customer_name: cust ? null : (customerName.trim() || null),   // CRM紐付け時はnull（customers.nameが真値）
      child_id: child?.id ?? null,
      reserved_at: `${date}T${time}:00+09:00`,
      purpose: choice.kind === 'fitting' ? choice.service.label : choice.info.label,
      service_type: choice.kind === 'fitting' ? choice.service.service_type : 'other',
      notes: notes.trim() || null,
      status: 'confirmed',
    })
    setSaving(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    onSaved()
  }

  // 各ステップの確定値（折りたたみ表示用）
  const summaryOf = (k: StepKey): string | null => {
    if (k === 'customer') return cust ? `${child?.name ?? cust.name} 様`
      : customerName.trim() ? `${customerName.trim()} 様（未登録）` : null
    if (k === 'purpose') return choiceLabel(choice)
    if (k === 'datetime') return time ? `${fmtDate(date)} ${time}` : null
    return null
  }

  return (
    <div className="bg-white border border-indigo-300 rounded-2xl overflow-hidden animate-fade-in">
      {/* ヘッダ + ステッパー */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="font-black text-gray-900 text-sm">予約受付</p>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </div>
        <div className="flex gap-1">
          {STEPS.map(s => {
            const done = s.key === 'confirm' ? canConfirm : !!summaryOf(s.key)
            const cur = step === s.key
            return (
              <button key={s.key} onClick={() => setStep(s.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-black border ${
                  cur ? 'bg-indigo-600 text-white border-indigo-600'
                  : done ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}>
                <span>{done && !cur ? '✓' : `${s.n}`}</span><span>{s.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 折りたたみサマリ（現在ステップ以外で確定済み） */}
        {STEPS.filter(s => s.key !== step && s.key !== 'confirm' && summaryOf(s.key)).map(s => (
          <button key={s.key} onClick={() => setStep(s.key)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-left">
            <Check size={14} className="text-emerald-600 shrink-0" />
            <span className="text-xs text-gray-500">{s.title}</span>
            <span className="text-sm font-bold text-gray-900 flex-1">{summaryOf(s.key)}</span>
            <span className="text-[11px] text-emerald-600 font-bold">変更</span>
          </button>
        ))}

        {/* STEP A お客様 */}
        {step === 'customer' && (
          <div className="space-y-2.5">
            <p className="text-lg font-black text-gray-900">どなたのご予約ですか？</p>
            {cust ? (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                <User size={16} className="text-indigo-600" />
                <span className="flex-1 font-black text-gray-900">{child?.name ?? cust.name} 様{child ? `（保護者: ${cust.name}）` : ''}</span>
                <button onClick={() => setSheetOpen(true)} className="text-xs font-bold text-indigo-600 px-2 py-1 border border-indigo-200 rounded-lg">変更</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button onClick={() => setSheetOpen(true)} className="w-full py-3.5 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 font-bold">
                  🔍 顧客を検索 / 登録済みのお客様
                </button>
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-bold">
                  <span className="flex-1 h-px bg-gray-200" />または<span className="flex-1 h-px bg-gray-200" />
                </div>
                <div>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                    placeholder="お名前（苗字だけでもOK）"
                    className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-base font-bold" />
                  <p className="text-[11px] text-gray-400 mt-1 px-1">未登録のお客様は氏名だけで受付できます（顧客台帳には登録されません）。</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep('purpose')} disabled={!hasIdentity}
                className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-black disabled:opacity-40">次へ</button>
            </div>
          </div>
        )}

        {/* STEP B 来店内容 */}
        {step === 'purpose' && (
          <div className="space-y-3">
            <p className="text-lg font-black text-gray-900">何のご来店ですか？</p>

            {/* 採寸（試着室を使う）＝予約枠を消費 */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-amber-600 flex items-center gap-1"><Clock size={12} /> 採寸（試着室を使用）</p>
              {services.length === 0 ? (
                <p className="text-[11px] text-gray-500 bg-gray-50 rounded-xl px-3 py-2.5">
                  採寸メニューが未設定です（設定 → 採寸予約設定）。
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {services.map(s => {
                    const sel = choice?.kind === 'fitting' && choice.service.service_type === s.service_type
                    return (
                      <button key={s.service_type} onClick={() => { setChoice({ kind: 'fitting', service: s }); setTime(null); setStep('datetime') }}
                        className={`py-4 rounded-2xl border-2 font-black text-base flex flex-col items-center gap-0.5 active:scale-[0.98] transition-all ${
                          sel ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                        }`}>
                        <span className="text-2xl">📏</span>{s.label}
                        <span className="text-[10px] font-bold text-amber-600">試着室を使用（{s.duration_min}分）</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 情報のみ＝予約枠を消費しない */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-gray-500">情報のみ（枠を消費しない）</p>
              <div className="grid grid-cols-2 gap-2">
                {INFO_PURPOSES.map(p => {
                  const sel = choice?.kind === 'info' && choice.info.key === p.key
                  return (
                    <button key={p.key} onClick={() => { setChoice({ kind: 'info', info: p }); setTime(null); setStep('datetime') }}
                      className={`py-4 rounded-2xl border-2 font-black text-base flex flex-col items-center gap-1 active:scale-[0.98] transition-all ${
                        sel ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                      }`}>
                      <span className="text-2xl">{p.emoji}</span>{p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP C 日時 */}
        {step === 'datetime' && (
          <div className="space-y-3">
            <p className="text-lg font-black text-gray-900">いつご来店されますか？</p>
            {/* 日付ナビ */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-3 py-2">
              <button onClick={() => { setDate(d => addDays(d, -1)) }} className="p-1.5 rounded-lg hover:bg-gray-200"><ChevronLeft size={18} /></button>
              <div className="flex-1 text-center">
                <p className="font-black text-gray-900">{date === todayJst() ? '今日' : fmtDate(date)}</p>
                <p className="text-[11px] text-gray-500">{date}</p>
              </div>
              <button onClick={() => { setDate(d => addDays(d, 1)) }} className="p-1.5 rounded-lg hover:bg-gray-200"><ChevronRight size={18} /></button>
            </div>

            {usesFitting ? (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5 flex items-center gap-1"><Clock size={12} /> 試着室の空き枠</p>
                {slotState === 'loading' && <div className="py-6 grid place-items-center"><Loader2 className="animate-spin text-indigo-400" /></div>}
                {slotState === 'closed' && <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-3 py-3 text-center">この日は予約を受け付けていません。</p>}
                {slotState === 'nosettings' && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-amber-600">予約枠が未設定です（設定 → 採寸予約設定）。時間は手入力できます。</p>
                    <input type="time" value={time ?? ''} onChange={e => setTime(e.target.value || null)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
                  </div>
                )}
                {slotState === 'ok' && (
                  slots.length === 0 ? <p className="text-sm text-gray-500 text-center py-4">空き枠がありません。別の日をお試しください。</p> : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {slots.map(s => {
                        const full = !s.available
                        const last = s.available && s.remaining === 1
                        return (
                          <button key={s.time} disabled={full} onClick={() => setTime(s.time)}
                            className={`py-2.5 rounded-xl border-2 text-sm font-black flex flex-col items-center ${
                              time === s.time ? 'border-indigo-600 bg-indigo-600 text-white'
                              : full ? 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
                              : last ? 'border-amber-400 bg-amber-50 text-amber-700'
                              : 'border-gray-200 bg-white text-gray-800'
                            }`}>
                            {s.time}
                            <span className="text-[9px] font-bold">{full ? '満員' : last ? 'あと1枠' : `残${s.remaining}`}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">時刻（枠の消費なし）</p>
                <input type="time" value={time ?? ''} onChange={e => setTime(e.target.value || null)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm" />
              </div>
            )}

            <button onClick={() => setStep('confirm')} disabled={!time}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-black disabled:opacity-40">確認へ</button>
          </div>
        )}

        {/* STEP 確認 */}
        {step === 'confirm' && (
          <div className="space-y-3">
            <p className="text-lg font-black text-gray-900">この内容で予約します</p>
            <div className="rounded-2xl border border-gray-200 divide-y text-sm">
              {[
                ['お客様', cust ? `${child?.name ?? cust.name} 様${child ? `（保護者: ${cust.name}）` : ''}`
                  : customerName.trim() ? `${customerName.trim()} 様（未登録）` : '（未記名）'],
                ['来店内容', choiceLabel(choice) ?? '（未選択）'],
                ['日時', time ? `${fmtDate(date)} ${time}` : '（未選択）'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2.5">
                  <span className="text-gray-400 font-bold w-20 shrink-0">{k}</span>
                  <span className="text-gray-900 font-bold flex-1">{v}</span>
                </div>
              ))}
              <div className="px-3 py-2.5">
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="メモ（任意・申し送り等）"
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              </div>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>}
            <button onClick={save} disabled={saving || !canConfirm}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} 予約を確定する
            </button>
          </div>
        )}
      </div>

      {sheetOpen && (
        <CustomerLinkSheet
          storeId={storeId} selectedCust={cust} selectedChild={child}
          onSelect={(c, ch) => { setCust(c); setChild(ch); setCustomerName('') }}
          onClear={() => { setCust(null); setChild(null) }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}
