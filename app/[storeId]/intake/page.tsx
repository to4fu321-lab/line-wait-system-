'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2, CheckCircle2, MessageCircle, AlertCircle, User,
  ChevronRight, Scissors, ShoppingBag, Plus,
} from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import { initLiff, getLineProfile } from '@/lib/liff'
import { resolveFeature } from '@/lib/features'
import type { Customer } from '@/types/crm'

type View = 'loading' | 'not_line' | 'disabled' | 'register_needed' | 'select' | 'form' | 'done'
type IntakeType = 'repair' | 'purchase'

export default function CustomerIntakePage() {
  const { storeId }  = useParams<{ storeId: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [view,        setView]        = useState<View>('loading')
  const [storeName,   setStoreName]   = useState('')
  const [lineUserId,  setLineUserId]  = useState('')
  const [customers,   setCustomers]   = useState<Customer[]>([])
  const [customer,    setCustomer]    = useState<Customer | null>(null)

  const [intakeType,  setIntakeType]  = useState<IntakeType>('repair')
  const [itemName,    setItemName]    = useState('')
  const [content,     setContent]     = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [notes,       setNotes]       = useState('')

  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [doneTicket,  setDoneTicket]  = useState<number | null>(null)
  const [doneItem,    setDoneItem]    = useState('')

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const { data: sd } = await (supabase as any).from('stores')
        .select('name, features').eq('id', storeId).single()
      if (sd?.name) setStoreName(sd.name)
      // 店舗フラグでセルフ依頼入力が無効ならフォームを出さない
      if (!resolveFeature('customer_self_intake', (sd?.features ?? {}) as Record<string, unknown>)) {
        setView('disabled'); return
      }

      const liff = await initLiff()
      if (!liff) { setView('not_line'); return }
      try {
        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href })
          return
        }
        const profile = await getLineProfile()
        if (!profile?.userId) { setView('not_line'); return }
        setLineUserId(profile.userId)

        const { data: list } = await supabase.from('customers')
          .select('*')
          .eq('store_id', storeId)
          .eq('line_user_id', profile.userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
        const found = (list ?? []) as Customer[]
        if (found.length === 0) { setView('register_needed'); return }
        setCustomers(found)

        // クエリの顧客ID（登録完了画面からの遷移）を優先して選択
        const preId = searchParams?.get('c')
        const pre   = preId ? found.find(c => c.id === preId) : null
        if (pre) { setCustomer(pre); setView('form') }
        else if (found.length === 1) { setCustomer(found[0]); setView('form') }
        else setView('select')
      } catch {
        setView('not_line')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const handleSubmit = async () => {
    if (!customer || !itemName.trim() || saving) return
    setSaving(true); setErrorMsg('')
    const today      = new Date().toISOString().slice(0, 10)
    const staffNotes = notes.trim() ? `📱お客様入力：${notes.trim()}` : '📱お客様入力'

    let err: { message: string } | null = null
    if (intakeType === 'purchase') {
      const res = await supabase.from('purchase_orders').insert({
        store_id:     storeId,
        customer_id:  customer.id,
        item_name:    itemName.trim(),
        notes:        staffNotes,
        status:       'ordered',
        ordered_date: today,
      })
      err = res.error
    } else {
      const res = await (supabase as any).from('repair_histories').insert({
        store_id:     storeId,
        customer_id:  customer.id,
        item_name:    itemName.trim(),
        content:      content.trim(),
        notes:        staffNotes,
        status:       'received',
        received_date: today,
        request_type: 'repair',
        prepaid:      false,
        desired_completion_date: desiredDate || null,
      })
      err = res.error
    }
    if (err) {
      setSaving(false)
      setErrorMsg('送信に失敗しました。もう一度お試しください。')
      return
    }

    // 店側端末へプッシュ通知（ベストエフォート）
    fetch('/api/push-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        type:  'self_intake',
        title: `📱 お客様入力：${customer.name} 様`,
        body:  `${intakeType === 'purchase' ? '追加購入' : 'お直し'} — ${itemName.trim()}`,
        url:   `/${storeId}/admin/crm`,
      }),
    }).catch(() => {})

    // 当日の受付番号があれば完了画面に表示
    let tn: number | null = null
    if (lineUserId) {
      const { data: q } = await supabase.from('queues')
        .select('ticket_number')
        .eq('store_id', storeId)
        .eq('line_user_id', lineUserId)
        .in('status', ['waiting', 'calling'])
        .gte('created_at', getTodayStart())
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      tn = q?.ticket_number ?? null
    }
    setDoneTicket(tn)
    setDoneItem(itemName.trim())
    setSaving(false)
    setView('done')
  }

  const resetForm = () => {
    setItemName(''); setContent(''); setDesiredDate(''); setNotes('')
    setErrorMsg('')
    setView('form')
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  // ── 機能無効（店舗設定） ──────────────────────
  if (view === 'disabled') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-4">
      <MessageCircle size={64} className="opacity-80" />
      <div>
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black mb-2">スタッフにお声がけください</h1>
        <p className="text-green-100 text-base">こちらの店舗では店頭にて<br />ご依頼を承っております</p>
      </div>
    </div>
  )

  // ── LINE未使用 ────────────────────────────────
  if (view === 'not_line') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-4">
      <MessageCircle size={64} className="opacity-80" />
      <div>
        <h1 className="text-2xl font-black mb-2">LINEで開いてください</h1>
        <p className="text-green-100 text-base">スタッフのQRコードをLINEカメラで<br />読み取ってください</p>
      </div>
    </div>
  )

  // ── 顧客登録が必要 ────────────────────────────
  if (view === 'register_needed') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center text-white">
        <MessageCircle size={56} className="mx-auto mb-3 opacity-90" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black mb-2">先にお客様登録が必要です</h1>
        <p className="text-green-100 text-sm">お名前の登録後に依頼内容を入力できます</p>
      </div>
      <button onClick={() => router.push(`/${storeId}/crm-register`)}
        className="w-full max-w-sm bg-white text-[#06C755] text-lg font-black py-4 rounded-2xl active:scale-95 transition-transform shadow-2xl">
        お客様登録へ進む
      </button>
    </div>
  )

  // ── 完了 ──────────────────────────────────────
  if (view === 'done') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-5">
      <CheckCircle2 size={72} />
      <div>
        <h1 className="text-3xl font-black mb-2">依頼を送信しました！</h1>
        <p className="text-lg font-bold opacity-90">{doneItem}</p>
      </div>

      {doneTicket != null && (
        <div className="bg-white rounded-3xl px-8 py-5 shadow-2xl w-full max-w-sm">
          <p className="text-zinc-500 text-xs font-bold mb-1">受付番号</p>
          <p className="ticket-number text-5xl font-black text-[#06C755] leading-none tracking-tight">
            {String(doneTicket).padStart(3, '0')}
          </p>
        </div>
      )}

      <div className="bg-white/20 rounded-2xl px-6 py-4 text-green-100 text-sm leading-relaxed max-w-sm">
        <p className="font-bold text-base">スタッフが内容を確認します</p>
        <p className="mt-1 opacity-90">金額・仕上がり日はスタッフ確認後に確定します。店内の方はそのままお待ちください。</p>
      </div>

      <button onClick={resetForm}
        className="w-full max-w-sm bg-white/15 border-2 border-white/50 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-white font-bold text-base active:scale-[0.98] transition-all">
        <Plus size={16} />続けて別の依頼を追加
      </button>
    </div>
  )

  // ── お子様（顧客）選択 ─────────────────────────
  if (view === 'select') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col px-5 pt-12 pb-8">
      <div className="text-white text-center mb-6">
        <MessageCircle size={44} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">どなたのご依頼ですか？</h1>
        <p className="text-green-100 text-sm mt-1">お名前を選択してください</p>
      </div>
      <div className="space-y-3">
        {customers.map(c => (
          <button key={c.id} onClick={() => { setCustomer(c); setView('form') }}
            className="w-full bg-white rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-[#06C755]" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-black text-zinc-900 text-base truncate">{c.name}</p>
              {c.school_name && <p className="text-zinc-400 text-xs truncate">{c.school_name}</p>}
            </div>
            <ChevronRight size={18} className="text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )

  // ── 依頼入力フォーム ───────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col px-5 pt-10 pb-8">
      <div className="text-center text-white mb-5">
        <MessageCircle size={40} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">依頼内容の入力</h1>
        {customer && (
          <button
            onClick={() => customers.length > 1 && setView('select')}
            className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5 text-sm font-bold">
            <User size={13} />{customer.name} 様
            {customers.length > 1 && <span className="text-green-200 text-xs">（変更）</span>}
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 w-full shadow-2xl space-y-4">

        {/* 依頼の種類 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">依頼の種類</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setIntakeType('repair')}
              className={`py-3 rounded-xl text-sm font-black border-2 flex items-center justify-center gap-1.5 transition-all ${
                intakeType === 'repair'
                  ? 'bg-green-50 border-[#06C755] text-[#06C755]'
                  : 'bg-zinc-50 border-zinc-100 text-zinc-400'
              }`}>
              <Scissors size={15} />お直し
            </button>
            <button onClick={() => setIntakeType('purchase')}
              className={`py-3 rounded-xl text-sm font-black border-2 flex items-center justify-center gap-1.5 transition-all ${
                intakeType === 'purchase'
                  ? 'bg-green-50 border-[#06C755] text-[#06C755]'
                  : 'bg-zinc-50 border-zinc-100 text-zinc-400'
              }`}>
              <ShoppingBag size={15} />追加購入
            </button>
          </div>
        </div>

        {/* 品名 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">
            {intakeType === 'purchase' ? 'ほしい商品' : 'お直しする品物'} <span className="text-red-500">*</span>
          </label>
          <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
            placeholder={intakeType === 'purchase' ? '例：夏用シャツ Mサイズ 2枚' : '例：スラックス'}
            className="w-full text-base font-bold text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        {/* お直し内容 */}
        {intakeType === 'repair' && (
          <>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">お直しの内容</label>
              <input type="text" value={content} onChange={e => setContent(e.target.value)}
                placeholder="例：裾上げ 5cm / ウエスト詰め"
                className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">希望のお渡し日（任意）</label>
              <input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)}
                className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
            </div>
          </>
        )}

        {/* メモ */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">その他・ご要望（任意）</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="例：急ぎでお願いしたい"
            className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed bg-zinc-50 rounded-xl px-3 py-2">
          金額・仕上がり日はスタッフが内容を確認してから確定します
        </p>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving || !itemName.trim()}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          {saving ? <><Loader2 size={20} className="animate-spin" />送信中...</> : 'この内容で依頼する'}
        </button>
      </div>
    </div>
  )
}
