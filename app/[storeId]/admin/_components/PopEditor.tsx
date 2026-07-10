'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ChevronLeft, Loader2, CheckCheck, Printer, ImageDown, Plus, Trash2,
  RefreshCw, Sparkles, QrCode,
} from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '@/lib/supabase'
import {
  PAPER, THEME_COLORS, mergePopSettings, generateMerits, generateQueueMerits, formatBusinessHours,
  type PopSettings, type PopMerit, type PaperSize, type Orientation, type PopTheme,
  type QrSize, type StoreFeatureFlags, type BusinessHours, type PopKind,
} from '@/lib/pop'
import { PopPreview } from './PopPreview'

// friend: 友だち登録POP（読み取り→友だち追加） / queue: 順番待ちQR POP（読み取り→即・順番待ち）
const KIND_CONFIG: Record<PopKind, {
  column: 'pop_settings' | 'queue_pop_settings'
  title: string
  urlLabel: string
  urlHint: string
  meritsTitle: string
  fileSuffix: string
}> = {
  friend: {
    column: 'pop_settings',
    title: '友だち登録POP',
    urlLabel: 'QRコードのURL（新規顧客登録QRを自動使用）',
    urlHint: 'お客様受付QR（新規顧客登録QR）と同じURLを自動で使用します。不正防止のため手動での変更はできません。',
    meritsTitle: '友だち登録でできること（機能連動）',
    fileSuffix: '友だち登録POP',
  },
  queue: {
    column: 'queue_pop_settings',
    title: '順番待ちQR POP',
    urlLabel: 'QRコードのURL（順番待ち受付QRを自動使用）',
    urlHint: '順番待ち受付QR（?action=queue）と同じURLを自動で使用します。不正防止のため手動での変更はできません。',
    meritsTitle: 'このQRでできること（機能連動）',
    fileSuffix: '順番待ちQR',
  },
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`w-12 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}>
      <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Card({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
      <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><span>{emoji}</span>{title}</p>
      {children}
    </div>
  )
}

export function PopEditor({ kind }: { kind: PopKind }) {
  const { storeId } = useParams<{ storeId: string }>()
  const cfg = KIND_CONFIG[kind]

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busyPng, setBusyPng]     = useState(false)

  const [storeName, setStoreName] = useState('')
  const [hoursText, setHoursText] = useState('')
  const [flags, setFlags]         = useState<StoreFeatureFlags>({ allowRemote: false, hasReservation: false, notificationFull: false })
  const [settings, setSettings]   = useState<PopSettings | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const previewRef = useRef<HTMLDivElement>(null)

  // ---- 読み込み ----
  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)

    const { data: store } = await (supabase as any)
      .from('stores')
      .select(`name, business_hours, allow_remote, notification_plan, ${cfg.column}`)
      .eq('id', storeId)
      .single()

    const { data: resv } = await (supabase as any)
      .from('reservation_settings')
      .select('is_active')
      .eq('store_id', storeId)

    const f: StoreFeatureFlags = {
      allowRemote:      !!store?.allow_remote,
      hasReservation:   Array.isArray(resv) && resv.some((r: { is_active: boolean }) => r.is_active),
      notificationFull: store?.notification_plan === 'full',
    }
    setFlags(f)
    setStoreName(store?.name ?? '')
    setHoursText(formatBusinessHours(store?.business_hours as BusinessHours | null))
    setSettings(mergePopSettings(store?.[cfg.column] ?? null, f, storeId, kind))
    setLoading(false)
  }, [storeId, cfg.column, kind])

  useEffect(() => { load() }, [load])

  // ---- QR生成 ----
  useEffect(() => {
    const url = settings?.friendUrl?.trim()
    if (!url) { setQrDataUrl(null); return }
    let cancelled = false
    import('qrcode').then(async QRCode => {
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 600, margin: 1, color: { dark: '#111827', light: '#ffffff' } })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch { if (!cancelled) setQrDataUrl(null) }
    })
    return () => { cancelled = true }
  }, [settings?.friendUrl])

  const up = (patch: Partial<PopSettings>) => setSettings(s => (s ? { ...s, ...patch } : s))

  // ---- メリット操作 ----
  const updateMerit = (i: number, patch: Partial<PopMerit>) =>
    setSettings(s => s ? { ...s, merits: s.merits.map((m, j) => j === i ? { ...m, ...patch } : m) } : s)
  const removeMerit = (i: number) =>
    setSettings(s => s ? { ...s, merits: s.merits.filter((_, j) => j !== i) } : s)
  const addMerit = () =>
    setSettings(s => s ? { ...s, merits: [...s.merits, { id: `custom_${Date.now()}`, text: '', enabled: true }] } : s)
  const regenerateMerits = () => {
    if (!confirm('有効な機能から候補を作り直します。編集した文言は上書きされます。よろしいですか？')) return
    setSettings(s => s ? { ...s, merits: kind === 'queue' ? generateQueueMerits(flags) : generateMerits(flags) } : s)
  }

  // ---- 保存 ----
  const handleSave = async () => {
    if (!settings) return
    setSaving(true); setSaveError(null)
    const { error } = await (supabase as any).from('stores').update({ [cfg.column]: settings }).eq('id', storeId)
    setSaving(false)
    if (error) setSaveError(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  // ---- 印刷 ----
  const handlePrint = () => {
    if (!settings) return
    const paper = PAPER[settings.paperSize]
    const landscape = settings.orientation === 'landscape'
    const w = landscape ? paper.h : paper.w
    const h = landscape ? paper.w : paper.h
    const style = document.createElement('style')
    style.id = 'pop-print-style'
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #pop-print-root, #pop-print-root * { visibility: visible !important; }
        #pop-print-root { position: fixed !important; top: 0; left: 0; width: ${w}mm !important; height: ${h}mm !important; box-shadow: none !important; }
        @page { size: ${w}mm ${h}mm; margin: 0; }
      }`
    document.head.appendChild(style)
    window.print()
    setTimeout(() => style.remove(), 1000)
  }

  // ---- PNG保存 ----
  const handlePng = async () => {
    if (!previewRef.current || !settings) return
    setBusyPng(true)
    try {
      // skipFonts: システムフォント使用のためWebフォント埋め込み不要。
      // 埋め込み処理はstylesheet fetchで停止することがあるため無効化する。
      // さらに万一停止してもボタンが固まらないよう15秒でタイムアウトさせる。
      const dataUrl = await Promise.race([
        toPng(previewRef.current, {
          pixelRatio: 3, cacheBust: true, skipFonts: true, backgroundColor: THEME_COLORS[settings.theme].bg,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
      ])
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${storeName || '店舗'}_${cfg.fileSuffix}.png`
      a.click()
    } catch (e) {
      console.error('POP PNG error:', e)
      alert('画像の生成に失敗しました。もう一度お試しください。')
    } finally {
      setBusyPng(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ヘッダー */}
      <div className="sticky top-0 z-40 bg-gray-50/90 backdrop-blur border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link href={`/${storeId}/admin/settings`} className="p-2 -ml-2 rounded-xl active:bg-gray-200/60 text-gray-600">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">{cfg.title}</h1>
            <p className="text-xs text-gray-500 truncate">{storeName}</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'}`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCheck size={14} /> : null}
            {saved ? '保存済み' : '保存'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 grid md:grid-cols-2 gap-4 pb-16">
        {/* プレビュー */}
        <div className="md:order-2">
          <div className="md:sticky md:top-24 space-y-3">
            <div className="bg-gray-100 rounded-2xl border border-gray-200 p-4 flex justify-center">
              <div style={{ maxWidth: settings.orientation === 'landscape' ? 460 : 340 }} className="w-full">
                <PopPreview ref={previewRef} settings={settings} qrDataUrl={qrDataUrl} storeName={storeName} hoursText={hoursText} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handlePrint}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm active:bg-gray-50 transition-colors">
                <Printer size={16} />印刷する
              </button>
              <button onClick={handlePng} disabled={busyPng}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm active:bg-gray-50 transition-colors disabled:opacity-50">
                {busyPng ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />}画像で保存
              </button>
            </div>
            {saveError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">保存エラー: {saveError}</p>}
          </div>
        </div>

        {/* 編集フォーム */}
        <div className="md:order-1 space-y-3">
          {/* 基本情報 */}
          <Card title="基本情報" emoji="📝">
            <Field label={cfg.urlLabel}>
              <input type="url" value={settings.friendUrl} readOnly disabled
                className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed" />
              <p className="text-[11px] text-gray-400 mt-1">{cfg.urlHint}</p>
            </Field>
            <Field label="大見出し">
              <input type="text" value={settings.headline} onChange={e => up({ headline: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none" />
            </Field>
            <Field label="サブコピー">
              <textarea value={settings.subCopy} onChange={e => up({ subCopy: e.target.value })} rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none resize-none" />
            </Field>
          </Card>

          {/* メリット */}
          <Card title={cfg.meritsTitle} emoji="✨">
            <p className="text-[11px] text-gray-400 -mt-2 flex items-center gap-1">
              <Sparkles size={12} className="text-indigo-400" />有効な機能から自動で候補を作成。文言は自由に編集できます。
            </p>
            <div className="space-y-2">
              {settings.merits.map((m, i) => (
                <div key={m.id} className="flex items-center gap-2">
                  <Toggle on={m.enabled} onToggle={() => updateMerit(i, { enabled: !m.enabled })} />
                  <input type="text" value={m.text} onChange={e => updateMerit(i, { text: e.target.value })}
                    placeholder="メリットの文言"
                    className={`flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:border-indigo-500 focus:outline-none ${m.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`} />
                  <button onClick={() => removeMerit(i)} className="shrink-0 p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={addMerit}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 text-xs">
                <Plus size={12} />行を追加
              </button>
              <button onClick={regenerateMerits}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 text-xs">
                <RefreshCw size={12} />候補を作り直す
              </button>
            </div>
          </Card>

          {/* 用紙・レイアウト */}
          <Card title="用紙・文字・デザイン" emoji="🎨">
            <Field label="用紙サイズ">
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PAPER) as PaperSize[]).map(k => (
                  <button key={k} onClick={() => up({ paperSize: k })}
                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${settings.paperSize === k ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    {PAPER[k].label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="向き">
              <div className="grid grid-cols-2 gap-2">
                {([['portrait', '縦'], ['landscape', '横']] as [Orientation, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => up({ orientation: v })}
                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${settings.orientation === v ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="文字の大きさ">
              <div className="grid grid-cols-3 gap-2">
                {([[0.9, '小'], [1, '中'], [1.15, '大']] as [number, string][]).map(([v, l]) => (
                  <button key={l} onClick={() => up({ fontScale: v })}
                    className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${settings.fontScale === v ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="テーマ色">
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(THEME_COLORS) as PopTheme[]).map(k => (
                  <button key={k} onClick={() => up({ theme: k })} title={THEME_COLORS[k].label}
                    className={`h-10 rounded-xl border-2 transition-all flex items-center justify-center ${settings.theme === k ? 'border-gray-900' : 'border-gray-200'}`}
                    style={{ backgroundColor: THEME_COLORS[k].accent }}>
                    {settings.theme === k && <CheckCheck size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          {/* QR・表示 */}
          <Card title="QR・表示項目" emoji="🔳">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><QrCode size={14} />QRコードを表示</p>
              <Toggle on={settings.showQr} onToggle={() => up({ showQr: !settings.showQr })} />
            </div>
            {settings.showQr && (
              <Field label="QRの大きさ">
                <div className="grid grid-cols-3 gap-2">
                  {([['sm', '小'], ['md', '中'], ['lg', '大']] as [QrSize, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => up({ qrSize: v })}
                      className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${settings.qrSize === v ? 'border-indigo-500 bg-indigo-500/10 text-indigo-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-600">店名を表示</p>
              <Toggle on={settings.showStoreName} onToggle={() => up({ showStoreName: !settings.showStoreName })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-600">営業時間を表示</p>
                {hoursText && <p className="text-[10px] text-gray-400 mt-0.5">{hoursText}</p>}
              </div>
              <Toggle on={settings.showHours} onToggle={() => up({ showHours: !settings.showHours })} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
