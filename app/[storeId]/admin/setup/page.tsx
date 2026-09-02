'use client'

// ============================================================================
//  初期設定ウィザード（/admin/setup）
//
//  新規店舗が最初に開くのはマスタ登録だが、項目が多く、どれが自店に要るのか
//  分からない画面だった。先に「何屋さんか」「外注を使うか」を聞いて、
//  必要なものだけを、順番に、その場で埋められるようにする。
//
//  ここで書くのは業務設定とマスタだけ。課金に関わる機能ON/OFF（features）は
//  スーパー管理画面の担当なので触らない。
// ============================================================================

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Check, Loader2, Plus, Trash2, Sparkles, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { seedRepairPresets } from '@/lib/repairPresets'
import { PRESET_SET_LABELS, type PresetKey } from '@/lib/repairProfile'
import { Toast } from '@/app/_components/Toast'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// ── 業種 ────────────────────────────────────────────────────
//  ここで選んだものが、取り込む料金プリセットと、あとで案内するマスタを決める。
type Trade = 'uniform' | 'repair' | 'racket' | 'other'

const TRADES: {
  id: Trade; emoji: string; label: string; desc: string
  presets: PresetKey[]
  /** 完了画面で案内するマスタ */
  next: { label: string; href: (sid: string) => string; why: string }[]
}[] = [
  {
    id: 'uniform', emoji: '🏫', label: '制服販売店', desc: '学校制服の販売・採寸・お直し',
    presets: ['uniform'],
    next: [
      { label: '学校・商品マスタ', href: s => `/${s}/admin/master/manage`, why: '学校ごとの規定品と価格を登録します' },
      { label: '受付マスタ',       href: s => `/${s}/admin/master/repair`, why: 'お直しの作業と料金を調整します' },
    ],
  },
  {
    id: 'repair', emoji: '✂️', label: 'お直し・リフォーム店', desc: '洋服のお直し・修繕が中心',
    presets: ['uniform'],
    next: [
      { label: '受付マスタ', href: s => `/${s}/admin/master/repair`, why: '作業と料金を自店の価格に直します' },
    ],
  },
  {
    id: 'racket', emoji: '🏸', label: 'ラケット・スポーツ店', desc: 'ガット張り・用具のメンテナンス',
    presets: ['racket'],
    next: [
      { label: '受付マスタ',   href: s => `/${s}/admin/master/repair`,    why: 'ガット張りの料金を自店の価格に直します' },
      { label: '糸・部材マスタ', href: s => `/${s}/admin/master/materials`, why: '取り扱うガットを登録すると受付でタップ選択できます' },
    ],
  },
  {
    id: 'other', emoji: '🧰', label: 'そのほか', desc: '上記にあてはまらない',
    presets: [],
    next: [
      { label: '受付マスタ', href: s => `/${s}/admin/master/repair`, why: '受け付ける作業と料金をゼロから作ります' },
    ],
  },
]

interface StaffDraft { name: string; kana: string }

export default function SetupWizardPage() {
  const router  = useRouter()
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => setToast({ msg, type })

  // 回答。1店舗で制服お直しとガット張りを両方やる、のような店が実在するので複数選択
  const [trades, setTrades]       = useState<Trade[]>([])
  const [useVendor, setUseVendor] = useState<boolean | null>(null)
  const [vendors, setVendors]     = useState<string[]>([''])
  const [staffDrafts, setStaff]   = useState<StaffDraft[]>([{ name: '', kana: '' }])
  const [importPreset, setImportPreset] = useState(true)

  // 既に登録済みのもの（2回目以降は「登録済み」と出して重複を防ぐ）
  const [existing, setExisting] = useState({ staff: 0, vendors: 0, items: 0 })
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const [store, st, vd, it] = await Promise.all([
        (supabase as any).from('stores').select('setup').eq('id', storeId).single(),
        (supabase as any).from('staff').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
        (supabase as any).from('repair_vendors').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
        (supabase as any).from('repair_items').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
      ])
      const setup = (store.data?.setup ?? {}) as { trade?: Trade; trades?: Trade[]; use_vendor?: boolean; done_at?: string }
      // trade（単数）は旧形式。読むときだけ吸収する
      const savedTrades = setup.trades ?? (setup.trade ? [setup.trade] : [])
      if (savedTrades.length > 0) setTrades(savedTrades)
      if (typeof setup.use_vendor === 'boolean') setUseVendor(setup.use_vendor)
      if (setup.done_at) setAlreadyDone(true)
      setExisting({ staff: st.count ?? 0, vendors: vd.count ?? 0, items: it.count ?? 0 })
      setImportPreset((it.count ?? 0) === 0)   // 既に作業があるなら取り込みは既定OFF
      setLoading(false)
    })()
  }, [storeId])

  const chosen = TRADES.filter(t => trades.includes(t.id))
  // 選んだ業種ぶんのプリセットと次にやることを、重複なくまとめる
  const presetKeys = Array.from(new Set(chosen.flatMap(t => t.presets)))
  const nextSteps  = chosen.flatMap(t => t.next)
    .filter((n, i, arr) => arr.findIndex(x => x.label === n.label) === i)

  // ステップ構成。外注を使わない店には外注先の入力を出さない
  const steps: { key: string; title: string }[] = [
    { key: 'trade',   title: 'どんなお店ですか？' },
    { key: 'vendor',  title: 'お直しの加工はどこで？' },
    ...(useVendor ? [{ key: 'vendors', title: '外注先を登録' }] : []),
    { key: 'staff',   title: 'スタッフを登録' },
    { key: 'preset',  title: '料金のひな形を入れる' },
    { key: 'done',    title: '設定を保存しました' },
  ]
  const total   = steps.length
  const current = steps[Math.min(step, total) - 1]

  const canNext =
    current?.key === 'trade'  ? trades.length > 0 :
    current?.key === 'vendor' ? useVendor !== null :
    true

  // ── 保存 ──────────────────────────────────────────────────
  const finish = useCallback(async () => {
    if (trades.length === 0) return
    setSaving(true)
    const problems: string[] = []

    const vendorNames = vendors.map(v => v.trim()).filter(Boolean)
    if (useVendor && vendorNames.length > 0) {
      const { error } = await (supabase as any).from('repair_vendors')
        .insert(vendorNames.map((name, i) => ({ store_id: storeId, name, sort_order: (i + 1) * 10, active: true })))
      if (error) problems.push(`外注先: ${error.message}`)
    }

    const staffRows = staffDrafts
      .map(s => ({ name: s.name.trim(), kana: s.kana.trim() }))
      .filter(s => s.name)
    if (staffRows.length > 0) {
      const { error } = await (supabase as any).from('staff')
        .insert(staffRows.map((s, i) => ({
          store_id: storeId, name: s.name, kana: s.kana || null,
          active: true, sort_order: (i + 1) * 10,
        })))
      if (error) problems.push(`スタッフ: ${error.message}`)
    }

    if (importPreset) {
      for (const key of presetKeys) {
        const r = await seedRepairPresets(storeId, key)
        if (r.error) problems.push(`${PRESET_SET_LABELS[key]}: ${r.error}`)
      }
    }

    // 回答は最後に保存する（途中で失敗したときに「完了」にしない）
    const { error: setupErr } = await (supabase as any).from('stores')
      .update({ setup: { trades, use_vendor: !!useVendor, done_at: new Date().toISOString() } })
      .eq('id', storeId)
    if (setupErr) problems.push(`設定の保存: ${setupErr.message}`)

    setSaving(false)
    if (problems.length > 0) { showToast('err', `一部保存できませんでした — ${problems.join(' / ')}`); return }
    setStep(total)   // 完了画面へ
  }, [trades, presetKeys, useVendor, vendors, staffDrafts, importPreset, storeId, total])

  const skipForNow = async () => {
    await (supabase as any).from('stores')
      .update({ setup: { skipped: true, done_at: new Date().toISOString() } })
      .eq('id', storeId)
    router.push(`/${storeId}/admin/settings/staff`)
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-20 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-lg mx-auto px-4 pt-3.5 pb-3">
          <div className="flex items-center gap-2">
            <Link href={`/${storeId}/admin/settings/staff`} className="p-1 -ml-1 text-white/80 hover:text-white">
              <ChevronLeft size={22} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/70">かんたん初期設定　{Math.min(step, total)} / {total}</p>
              <h1 className="text-white font-black text-base truncate">{current?.title}</h1>
            </div>
            {step < total && (
              <button onClick={skipForNow} className="text-[11px] font-bold text-white/70 hover:text-white shrink-0">あとで</button>
            )}
          </div>
          <div className="mt-2 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${(Math.min(step, total) / total) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {alreadyDone && step === 1 && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-bold">
            この店舗は設定済みです。やり直すと、スタッフ・外注先は<strong>追加</strong>されます（重複にご注意ください）。
          </p>
        )}

        {/* ── 1. 業種 ── */}
        {current?.key === 'trade' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              やっている業務を<strong>いくつでも</strong>選んでください。制服のお直しとガット張りを
              両方やっている、のような店もそのまま設定できます。選んだぶんに合わせて、必要なマスタと
              料金のひな形だけをご案内します。あとから変更できます。
            </p>
            <div className="space-y-2">
              {TRADES.map(t => {
                const on = trades.includes(t.id)
                return (
                  <button key={t.id} type="button"
                    onClick={() => setTrades(on ? trades.filter(x => x !== t.id) : [...trades, t.id])}
                    className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition flex items-center gap-3 ${
                      on ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}>
                    <span className="text-2xl shrink-0">{t.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-gray-900">{t.label}</span>
                      <span className="block text-[11px] text-gray-500">{t.desc}</span>
                    </span>
                    <span className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition ${
                      on ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                    }`}>
                      {on && <Check size={14} className="text-white" />}
                    </span>
                  </button>
                )
              })}
            </div>
            {trades.length > 1 && (
              <p className="text-[11px] font-bold text-indigo-600">
                {trades.length}つの業務で設定します。料金のひな形もまとめて取り込めます。
              </p>
            )}
          </>
        )}

        {/* ── 2. 外注の有無 ── */}
        {current?.key === 'vendor' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              外注を使う場合、受付画面で外注先をワンタップで選べるようにします。使わない場合はその欄自体を出しません。
            </p>
            {([
              { v: false, emoji: '🏠', label: '自店で仕上げる', desc: '外注は使わない' },
              { v: true,  emoji: '🏭', label: '外注に出すことがある', desc: '加工業者・仕立て屋に依頼する' },
            ] as const).map(o => (
              <button key={String(o.v)} type="button" onClick={() => setUseVendor(o.v)}
                className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition flex items-center gap-3 ${
                  useVendor === o.v ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                }`}>
                <span className="text-2xl shrink-0">{o.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-gray-900">{o.label}</span>
                  <span className="block text-[11px] text-gray-500">{o.desc}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {/* ── 3. 外注先 ── */}
        {current?.key === 'vendors' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              よく使う外注先を登録します。1件も入れずに進んでも構いません（あとから追加できます）。
              {existing.vendors > 0 && <> 既に{existing.vendors}件登録されています。</>}
            </p>
            <div className="space-y-2">
              {vendors.map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={INPUT} value={v} placeholder="例: ○○リフォーム / 自社工房"
                    onChange={e => setVendors(vendors.map((x, n) => n === i ? e.target.value : x))} />
                  {vendors.length > 1 && (
                    <button type="button" onClick={() => setVendors(vendors.filter((_, n) => n !== i))}
                      className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setVendors([...vendors, ''])}
              className="flex items-center gap-1 text-indigo-600 text-xs font-bold"><Plus size={13} />外注先を増やす</button>
          </>
        )}

        {/* ── 4. スタッフ ── */}
        {current?.key === 'staff' && (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              受付・完了のときに「誰がやったか」を残すために使います。あとから設定 → スタッフでも追加できます。
              {existing.staff > 0 && <> 既に{existing.staff}名登録されています。</>}
            </p>
            <div className="space-y-2">
              {staffDrafts.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={INPUT} value={s.name} placeholder="お名前"
                    onChange={e => setStaff(staffDrafts.map((x, n) => n === i ? { ...x, name: e.target.value } : x))} />
                  <input className={INPUT + ' w-32'} value={s.kana} placeholder="ふりがな"
                    onChange={e => setStaff(staffDrafts.map((x, n) => n === i ? { ...x, kana: e.target.value } : x))} />
                  {staffDrafts.length > 1 && (
                    <button type="button" onClick={() => setStaff(staffDrafts.filter((_, n) => n !== i))}
                      className="p-2 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setStaff([...staffDrafts, { name: '', kana: '' }])}
              className="flex items-center gap-1 text-indigo-600 text-xs font-bold"><Plus size={13} />スタッフを増やす</button>
          </>
        )}

        {/* ── 5. プリセット ── */}
        {current?.key === 'preset' && (
          <>
            {presetKeys.length > 0 ? (
              <>
                <p className="text-xs text-gray-500 leading-relaxed">
                  よくある作業と料金のひな形を入れておくと、ゼロから作らずに済みます。
                  <strong>金額は仮の値</strong>なので、取り込んだあと受付マスタで自店の価格に直してください。
                </p>
                <button type="button" onClick={() => setImportPreset(v => !v)}
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-left transition flex items-center gap-3 ${
                    importPreset ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}>
                  <Sparkles size={20} className={importPreset ? 'text-indigo-600' : 'text-gray-300'} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-gray-900">
                      {presetKeys.map(k => PRESET_SET_LABELS[k]).join(' ・ ')} を取り込む
                    </span>
                    <span className="block text-[11px] text-gray-500">
                      {importPreset ? '取り込みます（重複は追加されません）' : '取り込みません'}
                    </span>
                  </span>
                  {importPreset ? <Check size={18} className="text-indigo-600 shrink-0" /> : <X size={18} className="text-gray-300 shrink-0" />}
                </button>
                {existing.items > 0 && (
                  <p className="text-[11px] text-amber-600 font-bold">
                    既に{existing.items}件の作業が登録されています。取り込みは不足分だけ追加され、既存の金額は変わりません。
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-500 leading-relaxed">
                選んだ業務のひな形は用意がないので、受付マスタで実際の作業と料金を登録してください。
                次の画面から進めます。
              </p>
            )}
          </>
        )}

        {/* ── 6. 完了 ── */}
        {current?.key === 'done' && (
          <>
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
              <div className="text-4xl mb-1">🎉</div>
              <p className="font-black text-emerald-800">設定を保存しました</p>
              <p className="text-[11px] text-emerald-600 mt-1">
                {chosen.map(t => t.label).join(' ・ ')} として設定しました{useVendor ? '（外注あり）' : ''}
              </p>
            </div>
            <p className="text-xs font-bold text-gray-500">次はこちらを登録すると使い始められます</p>
            <div className="space-y-2">
              {nextSteps.map(n => (
                <Link key={n.label} href={n.href(storeId)}
                  className="flex items-center gap-3 rounded-2xl border-2 border-indigo-200 bg-white px-4 py-3.5 active:scale-[0.98] transition">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-indigo-700">{n.label}</span>
                    <span className="block text-[11px] text-gray-500">{n.why}</span>
                  </span>
                  <ChevronRight size={18} className="text-indigo-400 shrink-0" />
                </Link>
              ))}
            </div>
            <Link href={`/${storeId}/admin/settings/staff`}
              className="block w-full text-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-600">
              設定画面にもどる
            </Link>
          </>
        )}
      </div>

      {/* フッター操作 */}
      {current?.key !== 'done' && (
        <div className="sticky bottom-0 bg-white border-t px-4 py-3">
          <div className="max-w-lg mx-auto flex gap-2">
            <button type="button" onClick={() => step === 1 ? router.back() : setStep(step - 1)}
              className="flex items-center justify-center gap-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-600">
              <ChevronLeft size={16} />{step === 1 ? 'やめる' : '戻る'}
            </button>
            {step < total - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white disabled:opacity-40">
                次へ<ChevronRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={finish} disabled={saving || trades.length === 0}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white disabled:opacity-40">
                {saving ? <><Loader2 size={16} className="animate-spin" />保存中…</> : <><Check size={16} />この内容で始める</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
