'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Clock, CheckCircle2, ChevronDown, Loader2, MessageCircle, MapPin, User, ChevronRight, Plus } from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueCategory, Gender, WaitThreshold } from '@/types/database'
import { CATEGORY_LABELS, CATEGORY_ICONS, DEFAULT_THRESHOLDS, getWaitMessage } from '@/types/database'
import { initLiff, getLineProfile, isInLineApp, type LiffProfile } from '@/lib/liff'
import type { Customer } from '@/types/crm'

const SCHOOLS = [
  '○○高等学校',
  '○○高等学校（2年）',
  '△△中学校',
  '△△中学校（新入生）',
  '□□高等学校',
  '◇◇中学校',
  '◎◎高等学校',
  'その他（直接入力）',
]

type PageView = 'loading' | 'add_friend' | 'register' | 'details' | 'waiting' | 'calling' | 'completed' | 'cancelled' | 'self_cancelled' | 'closed' | 'crm_register'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

// ============================================================
// 友達追加画面
// ============================================================
function AddFriendView({ onAdded }: { onAdded: () => void }) {
  const [checking, setChecking] = useState(false)
  const [failed,   setFailed]   = useState(false)
  const addUrl = `https://line.me/R/ti/p/@${LINE_BASIC_ID.replace(/^@/, '')}`

  const handleCheck = async () => {
    setChecking(true); setFailed(false)
    try {
      const profile = await getLineProfile()
      if (profile?.userId) {
        const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
        const { friend } = await res.json()
        if (friend) { onAdded(); return }
      }
    } catch { /* ignore */ }
    setFailed(true); setChecking(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-green-700 flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
      <div className="text-center text-white mb-8 animate-slide-up">
        <div className="text-7xl mb-5">💬</div>
        <h1 className="text-3xl font-black mb-2 tracking-tight">友達追加が必要です</h1>
        <p className="text-emerald-100 text-base">順番が来たらLINEで通知が届きます</p>
      </div>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-slide-up">
        <a href={addUrl}
          className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xl font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-lg shadow-emerald-200">
          <MessageCircle size={24} />① 友達追加する
        </a>
        <button onClick={handleCheck} disabled={checking}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg">
          {checking ? <><Loader2 size={18} className="animate-spin" />確認中...</> : '② 追加済み → 受付へ進む'}
        </button>
        {failed && <p className="text-red-500 text-sm text-center">友達追加が確認できません。追加してから②を押してください。</p>}
      </div>
    </div>
  )
}

// ============================================================
// 受付フォーム画面
// ============================================================
const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male',   label: '男性',   icon: '👦' },
  { value: 'female', label: '女性',   icon: '👧' },
  { value: 'other',  label: 'その他', icon: '👤' },
]

function RegisterView({ storeId, storeName, onComplete, lineProfile, inLineApp, allowRemote, existingCustomers = [] }: {
  storeId: string; storeName: string
  onComplete: (ticket: Queue) => void
  lineProfile: LiffProfile | null; inLineApp: boolean
  allowRemote: boolean
  existingCustomers?: Customer[]
}) {
  const [schoolName,      setSchoolName]      = useState('')
  const [customSchool,    setCustomSchool]    = useState('')
  const [customerName,    setCustomerName]    = useState(lineProfile?.displayName ?? '')
  const [customerKana,    setCustomerKana]    = useState('')
  const [childName,       setChildName]       = useState('')
  const [gender,          setGender]          = useState<Gender | ''>('')
  const [category,        setCategory]        = useState<QueueCategory | ''>('')
  const [isRemote,        setIsRemote]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [waitingCount,    setWaitingCount]    = useState<number | null>(null)
  const nameEditedRef    = useRef(false)
  const kanaEditedRef    = useRef(false)

  const toKatakana = (str: string) =>
    str.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))

  const handleCustomerNameChange = (val: string) => {
    nameEditedRef.current = true
    setCustomerName(val)
    if (!kanaEditedRef.current) setCustomerKana(toKatakana(val))
    setError(null)
  }

  const handleCustomerKanaChange = (val: string) => {
    kanaEditedRef.current = true
    setCustomerKana(val)
  }

  const handleSelectCustomer = (c: Customer) => {
    setChildName(c.name)
    if (c.kana && !kanaEditedRef.current) setCustomerKana(c.kana)
    if (c.gender) setGender(c.gender as Gender)
    if (c.category) setCategory(c.category as QueueCategory)
    if (c.school_name) {
      if (SCHOOLS.includes(c.school_name)) {
        setSchoolName(c.school_name); setShowCustomInput(false)
      } else {
        setShowCustomInput(true); setCustomSchool(c.school_name)
      }
    }
    setError(null)
  }

  useEffect(() => {
    if (!nameEditedRef.current && lineProfile?.displayName) {
      setCustomerName(lineProfile.displayName)
    }
  }, [lineProfile?.displayName])

  useEffect(() => {
    supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .in('status', ['waiting', 'calling'])
      .gte('created_at', getTodayStart())
      .then(({ count }) => setWaitingCount(count ?? 0))
  }, [storeId])

  const handleSchoolChange = (val: string) => {
    setError(null)
    if (val === 'その他（直接入力）') { setShowCustomInput(true); setSchoolName('') }
    else { setShowCustomInput(false); setSchoolName(val) }
  }

  const finalSchoolName = showCustomInput ? customSchool : schoolName

  const handleSubmit = async () => {
    if (!finalSchoolName.trim()) { setError('学校名を選択または入力してください'); return }
    if (!customerName.trim())    { setError('氏名（保護者様）を入力してください'); return }
    if (!childName.trim())       { setError('お子様のお名前を入力してください'); return }
    if (!gender)                 { setError('性別を選択してください'); return }
    if (!category)               { setError('ご用件を選択してください'); return }
    setLoading(true); setError(null)
    try {
      const { data: storeData } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
      if (storeData && !storeData.is_open) {
        setError('現在受付を停止しています。スタッフにお声がけください。')
        setLoading(false); return
      }
      const { data: nextNum, error: rpcErr } = await supabase.rpc('get_next_ticket_number', { p_store_id: storeId })
      if (rpcErr) throw rpcErr
      const { data, error: insertErr } = await supabase.from('queues').insert({
        store_id: storeId, ticket_number: nextNum as number, status: 'waiting',
        school_name: finalSchoolName.trim(), customer_name: customerName.trim(),
        customer_kana: customerKana.trim() || null,
        child_name: childName.trim() || null, category: category as QueueCategory, gender: gender as Gender,
        line_user_id: lineProfile?.userId ?? null,
        is_remote: isRemote, checked_in: !isRemote,
      }).select().single()
      if (insertErr) throw insertErr
      if (!data) throw new Error('保存失敗')
      localStorage.setItem(`queue_ticket_id_${storeId}`, data.id)
      localStorage.setItem(`queue_ticket_date_${storeId}`, new Date().toDateString())
      if (data.line_user_id) {
        fetch('/api/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lineUserId: data.line_user_id, ticketNumber: data.ticket_number, customerName: data.customer_name, storeName, storeId, type: 'registered' }),
        }).catch(console.error)
      }
      onComplete(data)
    } catch (e) {
      console.error(e); setError('受付に失敗しました。もう一度お試しください。')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-700 flex flex-col">
      {/* ヘッダー：コンパクトに待ち人数も表示 */}
      <div className="px-5 pt-6 pb-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight">順番待ち受付</h1>
            {storeName && <p className="text-indigo-200 text-xs mt-0.5">{storeName}</p>}
          </div>
          {waitingCount !== null && (
            <div className="text-right bg-white/15 rounded-2xl px-4 py-2 backdrop-blur-sm border border-white/20">
              <p className="text-indigo-200 text-xs font-bold">現在の待ち</p>
              <p className="text-2xl font-black leading-none">{waitingCount}<span className="text-xs font-bold ml-0.5">組</span></p>
            </div>
          )}
        </div>
        {lineProfile ? (
          <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-2.5 py-1 mt-2 text-xs">
            <MessageCircle size={10} />LINE連携済み
          </div>
        ) : !inLineApp ? (
          <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-300/30 rounded-full px-2.5 py-1 mt-2 text-xs">
            ⚠️ LINEで開くと通知が届きます
          </div>
        ) : null}
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-4 pt-4 pb-6 animate-slide-up shadow-2xl overflow-y-auto">
        <div className="max-w-md mx-auto space-y-3">

          {existingCustomers.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-indigo-600 text-xs font-bold mb-2">👋 登録済みのお子様から選択</p>
              <div className="flex flex-wrap gap-2">
                {existingCustomers.map(c => (
                  <button key={c.id} type="button" onClick={() => handleSelectCustomer(c)}
                    className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="text-indigo-400 text-xs mt-1.5">タップすると情報が入力されます</p>
            </div>
          )}

          <FormField label="学校名" required>
            <div className="relative">
              <select
                className="w-full appearance-none text-sm border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 pr-9 focus:border-indigo-400 focus:bg-white focus:outline-none text-gray-800 transition-all"
                value={showCustomInput ? 'その他（直接入力）' : schoolName}
                onChange={e => handleSchoolChange(e.target.value)}
              >
                <option value="">選択してください</option>
                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
            {showCustomInput && (
              <input type="text"
                className="mt-1.5 w-full text-sm border-2 border-indigo-200 bg-indigo-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:outline-none transition-all"
                placeholder="学校名を入力してください"
                value={customSchool}
                onChange={e => { setCustomSchool(e.target.value); setError(null) }}
                autoFocus />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="氏名（保護者様）" required>
              <input type="text" inputMode="text" autoComplete="name"
                className="w-full text-sm border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：山田 太郎"
                value={customerName}
                onChange={e => handleCustomerNameChange(e.target.value)} />
            </FormField>
            <FormField label="お子様のお名前" required>
              <input type="text" inputMode="text" autoComplete="off"
                className="w-full text-sm border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：山田 花子"
                value={childName}
                onChange={e => setChildName(e.target.value)} />
            </FormField>
          </div>

          <FormField label="フリガナ（保護者様）">
            <input type="text" inputMode="text"
              className="w-full text-sm border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
              placeholder="ヤマダ タロウ"
              value={customerKana}
              onChange={e => handleCustomerKanaChange(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="性別" required>
              <div className="grid grid-cols-3 gap-1">
                {GENDER_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => setGender(opt.value)}
                    className={`py-2 rounded-xl border-2 text-center transition-all active:scale-95 ${
                      gender === opt.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                    <div className="text-lg">{opt.icon}</div>
                    <div className={`text-xs font-bold mt-0.5 ${gender === opt.value ? 'text-indigo-700' : 'text-gray-500'}`}>{opt.label}</div>
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="ご用件" required>
              <div className="grid grid-cols-3 gap-1">
                {(['fitting', 'pickup', 'other'] as QueueCategory[]).map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`py-2 rounded-xl border-2 text-center transition-all active:scale-95 ${
                      category === cat ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                    <div className="text-lg">{CATEGORY_ICONS[cat]}</div>
                    <div className={`text-xs font-bold mt-0.5 ${category === cat ? 'text-indigo-700' : 'text-gray-500'}`}>{CATEGORY_LABELS[cat]}</div>
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {allowRemote && (
            <button type="button" onClick={() => setIsRemote(v => !v)}
              className={`w-full py-2.5 rounded-xl border-2 px-4 flex items-center justify-between transition-all active:scale-[0.98] ${
                isRemote ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50'
              }`}>
              <div className="text-left">
                <p className={`font-bold text-sm ${isRemote ? 'text-indigo-700' : 'text-gray-600'}`}>🏠 遠隔チェックイン</p>
                <p className="text-xs text-gray-400">今すぐ来店しない</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors shrink-0 ${isRemote ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 shadow transition-transform ${isRemote ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
              <AlertCircle size={15} className="shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
          )}

          <button type="button" onClick={handleSubmit} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-lg font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" />受付中...</> : '受付する →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 詳細情報入力画面（受付後）
// ============================================================
function DetailsView({ ticket, storeId, onComplete, onSkip }: {
  ticket: Queue; storeId: string
  onComplete: (updated: Queue) => void
  onSkip: () => void
}) {
  const [height,      setHeight]      = useState('')
  const [weight,      setWeight]      = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [position,    setPosition]    = useState<number | null>(null)

  useEffect(() => {
    supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .in('status', ['waiting', 'calling'])
      .lt('ticket_number', ticket.ticket_number)
      .gte('created_at', getTodayStart())
      .then(({ count }) => setPosition((count ?? 0) + 1))
  }, [storeId, ticket.ticket_number])
  const [loading,     setLoading]     = useState(false)

  const handleSubmit = async () => {
    const details: Record<string, string> = {}
    if (height.trim())      details.height      = height.trim()
    if (weight.trim())      details.weight      = weight.trim()
    if (parentPhone.trim()) details.parentPhone = parentPhone.trim()

    if (Object.keys(details).length === 0) { onSkip(); return }
    setLoading(true)
    const { data } = await supabase.from('queues').update({ details }).eq('id', ticket.id).select().single()
    setLoading(false)
    data ? onComplete(data) : onSkip()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 flex flex-col">
      {/* 受付完了バナー */}
      <div className="px-5 pt-8 pb-5 text-center text-white">
        <div className="text-5xl mb-2">✅</div>
        <h1 className="text-3xl font-black tracking-tight">受付完了！</h1>
        {position !== null ? (
          <div className="mt-2">
            <p className="text-emerald-100 text-sm font-bold">並んだ順番</p>
            <p className="text-white leading-none">
              <span className="text-7xl font-black">{position}</span>
              <span className="text-2xl font-bold ml-1">番目</span>
            </p>
            <p className="text-emerald-100 text-sm mt-1">現在 <span className="font-black text-white text-base">{position}番目</span> に並んでいます</p>
          </div>
        ) : (
          <p className="text-emerald-100 text-base font-bold mt-2">順番を確認中...</p>
        )}
        <p className="text-emerald-200 text-xs mt-3">受付はすでに完了しています。<br />以下の入力はしなくてもOKです。</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-4 pt-5 pb-6 shadow-2xl">
        <div className="max-w-md mx-auto space-y-4">

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-center">
            <p className="text-emerald-700 text-sm font-bold">📏 スタッフがスムーズにご案内するために</p>
            <p className="text-emerald-600 text-xs mt-0.5">身長・体重・電話番号をご入力ください（任意）</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="お子様の身長（cm）">
              <input type="number" inputMode="numeric"
                className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-3 focus:border-emerald-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：155"
                value={height}
                onChange={e => setHeight(e.target.value)} />
            </FormField>
            <FormField label="お子様の体重（kg）">
              <input type="number" inputMode="numeric"
                className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-3 focus:border-emerald-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：50"
                value={weight}
                onChange={e => setWeight(e.target.value)} />
            </FormField>
          </div>

          <FormField label="保護者の電話番号">
            <input type="tel" inputMode="tel" autoComplete="tel"
              className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-3 py-3 focus:border-emerald-400 focus:bg-white focus:outline-none transition-all"
              placeholder="例：090-1234-5678"
              value={parentPhone}
              onChange={e => setParentPhone(e.target.value)} />
          </FormField>

          <button type="button" onClick={handleSubmit} disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-lg font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" />保存中...</> : '入力して順番待ちへ →'}
          </button>

          {/* スキップを目立たせる */}
          <button type="button" onClick={onSkip}
            className="w-full py-3.5 rounded-2xl border-2 border-gray-200 bg-gray-50 text-gray-600 text-base font-bold active:scale-95 transition-all flex items-center justify-center gap-2">
            <span>⏭</span> 後で入力する（車・待合室で入力）
          </button>
          <p className="text-center text-gray-400 text-xs">※ 入力しなくても受付は完了しています</p>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-2">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

// ============================================================
// 待機中画面
// ============================================================
function WaitingView({ ticket, waitingAhead, waitThresholds, onStatusChange, onCheckIn, onCancel, storeId, storeName }: {
  ticket: Queue; waitingAhead: number; waitThresholds: WaitThreshold[]
  onStatusChange: (s: 'calling' | 'completed' | 'cancelled') => void
  onCheckIn: () => void
  onCancel: () => Promise<void>
  storeId: string; storeName: string
}) {
  const [checkinLoading,    setCheckinLoading]    = useState(false)
  const [showCancelModal,   setShowCancelModal]   = useState(false)
  const [cancellingTicket,  setCancellingTicket]  = useState(false)

  useEffect(() => {
    if (ticket.status === 'calling')    onStatusChange('calling')
    else if (ticket.status === 'completed') onStatusChange('completed')
    else if (ticket.status === 'cancelled') onStatusChange('cancelled')
  }, [ticket.status, onStatusChange])

  const waitMsg        = getWaitMessage(waitingAhead, waitThresholds.length > 0 ? waitThresholds : DEFAULT_THRESHOLDS)
  const isRemoteWaiting = ticket.is_remote && !ticket.checked_in

  const handleCheckin = async () => {
    setCheckinLoading(true)
    await supabase.from('queues').update({ checked_in: true }).eq('id', ticket.id)
    setCheckinLoading(false)
    onCheckIn()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-blue-900 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-5%,rgba(139,92,246,0.3),transparent)] pointer-events-none" />

      <div className="relative px-6 py-6 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-xs font-medium mb-3">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          リアルタイム更新中
        </div>
        <h1 className="text-2xl font-black tracking-tight">
          {isRemoteWaiting ? '🏠 遠隔待ち受付中' : '受付完了'}
        </h1>
        {storeName && <p className="text-indigo-200 text-sm mt-1">{storeName}</p>}
      </div>

      <main className="relative flex-1 flex flex-col items-center px-5 pb-10 max-w-md mx-auto w-full">

        {/* メインカード */}
        <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 text-center animate-slide-up">
          <p className="text-white/60 text-sm font-medium mb-1 tracking-wide">あなたの整理番号</p>
          <div className="ticket-number text-[88px] font-black text-white leading-none tracking-tight drop-shadow-2xl">
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>

          <div className="mt-6 bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5">
            <p className="text-white/60 text-sm font-medium mb-2">現在の順番</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="ticket-number text-6xl font-black text-white leading-none">{waitingAhead + 1}</span>
              <span className="text-xl font-bold text-white/70">番目</span>
            </div>
            {waitMsg && !isRemoteWaiting && (
              <p className="text-white/80 text-sm font-medium mt-3 leading-relaxed">{waitMsg}</p>
            )}
            {isRemoteWaiting && (
              <p className="text-indigo-200/70 text-sm mt-3">店舗に到着したらチェックインしてください</p>
            )}
          </div>

          <div className="mt-5 bg-white/8 border border-white/10 rounded-2xl p-4 text-left space-y-2.5">
            <InfoRow label="学校名" value={ticket.school_name} />
            <InfoRow label="氏名"   value={`${ticket.customer_name} 様`} />
            {ticket.child_name && <InfoRow label="お子様" value={ticket.child_name} />}
            <InfoRow label="ご用件" value={`${CATEGORY_ICONS[ticket.category]} ${CATEGORY_LABELS[ticket.category]}`} />
          </div>

          {ticket.line_user_id ? (
            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-400/20 border border-emerald-400/30 rounded-full px-4 py-2 text-emerald-300">
              <MessageCircle size={13} />
              <span className="text-sm font-medium">LINEで呼出通知が届きます</span>
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-full px-4 py-2 text-amber-300">
              <span className="text-sm font-medium">📱 この画面を閉じないでください</span>
            </div>
          )}
        </div>

        {/* 遠隔 — チェックインボタン（常時表示） */}
        {isRemoteWaiting && (
          <div className="w-full mt-4 space-y-3 animate-fade-in">
            <button
              onClick={handleCheckin}
              disabled={checkinLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white text-xl font-black py-6 rounded-2xl shadow-2xl shadow-emerald-900/50 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
            >
              {checkinLoading
                ? <><Loader2 size={22} className="animate-spin" />チェックイン中...</>
                : <><MapPin size={22} />店舗付近に到着しました。（5分以内で来店可能）</>
              }
            </button>
            <p className="text-center text-indigo-200/60 text-xs">チェックイン後に呼び出し対象となります</p>
          </div>
        )}

        {/* 遠隔 — チェックイン済み */}
        {ticket.is_remote && ticket.checked_in && (
          <div className="w-full mt-4 animate-fade-in">
            <div className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/40 rounded-2xl p-4 text-center">
              <p className="text-emerald-300 font-black text-lg">✅ チェックイン済み</p>
              <p className="text-emerald-200/70 text-sm mt-1">駐車場や店舗付近でお待ちください。</p>
            </div>
          </div>
        )}

        {/* 詳細情報入力ボタン（現地・遠隔チェックイン済み共通） */}
        {(!ticket.is_remote || ticket.checked_in) && (
          <div className="w-full mt-4 animate-fade-in">
            <a href={`/${storeId}/details?ticketId=${ticket.id}`}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-black py-5 rounded-2xl shadow-2xl shadow-orange-900/50 flex items-center justify-center gap-3 active:scale-95 transition-all">
              <span>📏</span><span>身長・体重・電話番号を入力する</span>
            </a>
            <p className="text-center text-orange-200/80 text-sm font-medium mt-2">入力するとスタッフがスムーズにご案内できます（任意）</p>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 text-white/40">
          <Clock size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
          <span className="text-xs">15秒ごとに自動更新</span>
        </div>

        {/* 並ぶのをやめるリンク */}
        <button
          onClick={() => setShowCancelModal(true)}
          className="mt-4 text-white/25 text-xs underline underline-offset-2 hover:text-white/50 transition-colors"
        >
          並ぶのをやめる
        </button>
      </main>

      {/* キャンセル確認モーダル */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-t-3xl p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-white font-black text-xl mb-2 text-center">並ぶのをやめますか？</h3>
            <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">
              再度並ぶ場合は最後尾からとなります。<br />
              この操作は取り消せません。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="py-4 rounded-xl bg-zinc-800 text-white font-bold active:scale-95 transition-transform"
              >
                戻る
              </button>
              <button
                onClick={async () => { setCancellingTicket(true); await onCancel() }}
                disabled={cancellingTicket}
                className="py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {cancellingTicket && <Loader2 size={18} className="animate-spin" />}
                キャンセルする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="font-bold text-white text-sm text-right max-w-[60%]">{value}</span>
    </div>
  )
}

// ============================================================
// 呼出中画面
// ============================================================
function CallingView({ ticket, onComplete }: { ticket: Queue; onComplete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [loading,    setLoading]    = useState(false)

  const handleComplete = async () => {
    setLoading(true)
    await supabase.from('queues').update({ status: 'completed' }).eq('id', ticket.id)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-300 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-slide-up">
        <div className="text-8xl mb-3"><span className="animate-ring inline-block">🔔</span></div>
        <h2 className="text-4xl font-black text-orange-900 leading-tight mb-2">お呼び<br />しています！</h2>
        <p className="text-lg font-bold text-orange-800 mb-6">カウンターへお越しください</p>

        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
          <p className="text-sm text-gray-400 mb-1 font-medium">整理番号</p>
          <div className="ticket-number text-[88px] font-black text-indigo-600 leading-none tracking-tight">
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>
          <p className="text-xl font-bold text-gray-700 mt-3">{ticket.customer_name} 様</p>
          <p className="text-sm text-gray-500 mt-1">{ticket.school_name}</p>
          <p className="text-xs text-gray-300 mt-4 border-t pt-3">📱 この画面をスタッフに見せてください</p>
        </div>
      </div>

      <div className="px-6 pb-10 pt-4">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            ✅ スタッフから案内を受けました
          </button>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-xl space-y-3 animate-fade-in">
            <p className="text-center font-bold text-gray-800">案内を受けましたか？</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirming(false)}
                className="py-4 rounded-xl bg-gray-100 text-gray-600 font-bold active:scale-95 transition-transform"
              >
                いいえ
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="py-4 rounded-xl bg-emerald-500 text-white font-black active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                はい
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 完了・不在・受付停止画面
// ============================================================
function CompletedView({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-teal-700 flex flex-col items-center justify-center px-6">
      <div className="relative text-center animate-slide-up">
        <div className="w-28 h-28 rounded-full bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={60} className="text-white" />
        </div>
        <h2 className="text-4xl font-black text-white mb-2">ご対応完了</h2>
        <p className="text-emerald-100 text-xl mb-10">ありがとうございました！</p>
        <button onClick={onReset} className="bg-white text-emerald-700 text-xl font-black py-5 px-10 rounded-2xl shadow-xl active:scale-95 transition-transform">最初に戻る</button>
      </div>
    </div>
  )
}

function SelfCancelledView({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center px-6">
      <div className="text-center animate-slide-up">
        <div className="text-7xl mb-5">👋</div>
        <h2 className="text-3xl font-black text-white mb-2">キャンセルしました</h2>
        <p className="text-zinc-400 text-lg mb-2">受付をキャンセルしました</p>
        <p className="text-zinc-500 text-sm mb-10">再度並ぶ場合は最後尾からとなります</p>
        <button onClick={onReset} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xl font-black py-5 px-10 rounded-2xl shadow-xl active:scale-95 transition-transform">もう一度受付する</button>
      </div>
    </div>
  )
}

function CancelledView({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center px-6">
      <div className="relative text-center animate-slide-up">
        <div className="text-7xl mb-5">😔</div>
        <h2 className="text-3xl font-black text-white mb-2">お呼びしましたが</h2>
        <p className="text-zinc-400 text-lg mb-2">ご不在のためキャンセルされました</p>
        <p className="text-zinc-500 text-sm mb-10">再度受付が必要な場合は下のボタンを押してください</p>
        <button onClick={onReset} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xl font-black py-5 px-10 rounded-2xl shadow-xl active:scale-95 transition-transform">もう一度受付する</button>
      </div>
    </div>
  )
}

function ClosedView() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="relative text-center text-white animate-slide-up">
        <div className="text-7xl mb-5">🚪</div>
        <h1 className="text-3xl font-black mb-2">現在受付を停止しています</h1>
        <p className="text-zinc-400 text-lg">店頭スタッフにお声がけください</p>
      </div>
    </div>
  )
}

// ============================================================
// お直し顧客登録ビュー（QRコードからの顧客登録）
// ============================================================
function CrmRegisterView({ storeId, storeName, lineProfile }: {
  storeId: string; storeName: string; lineProfile: LiffProfile | null
}) {
  type CrmView = 'loading' | 'existing' | 'new_form' | 'done' | 'not_line'
  const [crmView,      setCrmView]      = useState<CrmView>('loading')
  const [existingList, setExistingList] = useState<Customer[]>([])
  const [name,         setName]         = useState('')
  const [saving,       setSaving]       = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [doneName,     setDoneName]     = useState('')

  useEffect(() => {
    if (!lineProfile?.userId) { setCrmView('not_line'); return }
    ;(async () => {
      const { data } = await supabase.from('customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('line_user_id', lineProfile.userId)
        .order('created_at', { ascending: true })
      if (data && data.length > 0) {
        setExistingList(data as Customer[])
        setCrmView('existing')
      } else {
        setName(lineProfile.displayName ?? '')
        setCrmView('new_form')
      }
    })()
  }, [storeId, lineProfile?.userId])

  const handleRegister = async () => {
    if (!name.trim() || !lineProfile?.userId) return
    setSaving(true); setErrorMsg('')
    const { error } = await supabase.from('customers').insert({
      store_id: storeId, name: name.trim(), line_user_id: lineProfile.userId,
    })
    setSaving(false)
    if (error) {
      setErrorMsg(error.message.includes('unique') ? '同じお名前のお子様が既に登録されています' : '登録に失敗しました。もう一度お試しください。')
      return
    }
    setDoneName(name.trim()); setCrmView('done')
  }

  if (crmView === 'loading') return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  if (crmView === 'not_line') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-4">
      <MessageCircle size={64} className="opacity-80" />
      <div>
        <h1 className="text-2xl font-black mb-2">LINEで開いてください</h1>
        <p className="text-green-100 text-base">スタッフのQRコードをLINEカメラで<br />読み取ってください</p>
      </div>
    </div>
  )

  if (crmView === 'done') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-5">
      <CheckCircle2 size={88} />
      <div>
        <h1 className="text-4xl font-black mb-2">確認しました！</h1>
        <p className="text-2xl font-bold mb-1">{doneName} 様</p>
      </div>
      <div className="bg-white/20 rounded-2xl px-6 py-4 text-green-100 text-base leading-relaxed">
        <p className="font-bold">スタッフにお声がけください</p>
        <p className="text-sm mt-1 opacity-80">お直しの受付を行います</p>
      </div>
    </div>
  )

  if (crmView === 'existing') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col px-5 pt-12 pb-8">
      <div className="text-white text-center mb-6">
        <MessageCircle size={44} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">登録済みのお子様</h1>
        <p className="text-green-100 text-sm mt-1">お名前を選択してください</p>
      </div>
      <div className="space-y-3 mb-4">
        {existingList.map(c => (
          <button key={c.id} onClick={() => { setDoneName(c.name); setCrmView('done') }}
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
      <button onClick={() => { setName(''); setCrmView('new_form') }}
        className="w-full bg-white/20 border-2 border-white/40 rounded-2xl py-4 flex items-center justify-center gap-2 text-white font-bold text-base active:scale-[0.98] transition-all">
        <Plus size={18} />別のお子様を新規登録
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center text-white">
        <MessageCircle size={48} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">お子様の登録</h1>
        <p className="text-green-100 text-sm mt-1">
          {lineProfile?.displayName ? `${lineProfile.displayName} さんのLINEで登録します` : 'LINEで顧客登録を行います'}
        </p>
      </div>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5">
        <div>
          <p className="text-zinc-500 text-xs font-bold text-center mb-2">お子様のお名前を入力してください</p>
          <input type="text" value={name}
            onChange={e => { setName(e.target.value); setErrorMsg('') }}
            placeholder="例：山田 花子"
            className="w-full text-center text-xl font-black text-zinc-900 border-b-2 border-zinc-200 focus:border-[#06C755] focus:outline-none py-2 bg-transparent placeholder-zinc-300" />
        </div>
        {errorMsg && (
          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}
        <button onClick={handleRegister} disabled={saving || !name.trim()}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          {saving ? <><Loader2 size={20} className="animate-spin" />登録中...</> : <><MessageCircle size={20} />登録する</>}
        </button>
        {existingList.length > 0 && (
          <button onClick={() => setCrmView('existing')}
            className="w-full text-zinc-400 text-sm py-2 hover:text-zinc-600 transition-colors">
            ← 登録済みのお子様に戻る
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [view,              setView]              = useState<PageView>('loading')
  const [ticket,            setTicket]            = useState<Queue | null>(null)
  const [waitingAhead,      setWaitingAhead]      = useState(0)
  const [lineProfile,       setLineProfile]       = useState<LiffProfile | null>(null)
  const [inLineApp,         setInLineApp]         = useState(false)
  const [storeName,         setStoreName]         = useState('')
  const [waitThresholds,    setWaitThresholds]    = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [allowRemote,       setAllowRemote]       = useState(false)
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const ticketRef  = useRef<Queue | null>(null)

  const ticketKey = `queue_ticket_id_${storeId}`
  const dateKey   = `queue_ticket_date_${storeId}`

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const savedId   = localStorage.getItem(ticketKey)
      const savedDate = localStorage.getItem(dateKey)
      const hasSavedTicket = savedId && savedDate === new Date().toDateString()

      const { data: sd } = await supabase.from('stores')
        .select('is_open, name, wait_thresholds, allow_remote').eq('id', storeId).single()
      if (sd?.name)            setStoreName(sd.name)
      if (Array.isArray(sd?.wait_thresholds) && sd.wait_thresholds.length > 0)
        setWaitThresholds(sd.wait_thresholds as WaitThreshold[])
      if (sd?.allow_remote != null) setAllowRemote(sd.allow_remote)

      const liff   = await initLiff()
      const inLine = isInLineApp()
      setInLineApp(inLine)

      // LIFF初期化後にURLを確認（LIFFがliff.stateをデコードしてURLを書き換えるため）
      const sp = new URLSearchParams(window.location.search)
      const liffState = decodeURIComponent(sp.get('liff.state') || '')
      const isCrmMode = sp.get('mode') === 'crm_register' ||
        liffState.includes('mode=crm_register')

      if (liff && inLine) {
        try {
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile()
            setLineProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl })
          }
        } catch { /* ignore */ }
      }

      if (!isCrmMode && !hasSavedTicket && sd && !sd.is_open) { setView('closed'); return }

      // CRMモードはそのままCRM登録画面へ
      if (isCrmMode) {
        const profile = await getLineProfile()
        if (profile) setLineProfile(profile)
        setView('crm_register')
        return
      }

      if (hasSavedTicket) { setView('register'); return }
      if (!liff || !inLine) { setView('register'); return }

      const profile = await getLineProfile()
      if (profile) setLineProfile(profile)

      if (profile?.userId) {
        // 登録済み顧客情報を取得してフォームへ事前入力
        supabase.from('customers')
          .select('*')
          .eq('store_id', storeId)
          .eq('line_user_id', profile.userId)
          .order('created_at', { ascending: true })
          .then(({ data }) => {
            if (data && data.length > 0) setExistingCustomers(data as Customer[])
          })

        try {
          const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
          const { friend } = await res.json()
          setView(friend ? 'register' : 'add_friend')
        } catch { setView('register') }
      } else { setView('add_friend') }
    })()
  }, [storeId, ticketKey, dateKey])

  useEffect(() => {
    if (view !== 'register' || !storeId) return
    const savedId   = localStorage.getItem(ticketKey)
    const savedDate = localStorage.getItem(dateKey)
    if (savedId && savedDate === new Date().toDateString()) {
      supabase.from('queues').select('*').eq('id', savedId).single()
        .then(({ data }) => {
          if (data) {
            setTicket(data)
            const v = data.status === 'calling' ? 'calling'
              : data.status === 'completed' ? 'completed'
              : data.status === 'cancelled' ? 'cancelled'
              : 'waiting'
            setView(v)
          }
        })
    }
  }, [view, storeId, ticketKey, dateKey])

  const fetchWaitingAhead = useCallback(async (t: Queue) => {
    const { count } = await supabase.from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .in('status', ['waiting', 'calling'])
      .lt('ticket_number', t.ticket_number).gte('created_at', getTodayStart())
    setWaitingAhead(count ?? 0)
  }, [storeId])

  // ticketRef で stale closure を防ぐ
  useEffect(() => { ticketRef.current = ticket }, [ticket])

  useEffect(() => {
    if (!ticket) return
    ticketRef.current = ticket
    fetchWaitingAhead(ticket)

    // Realtime が無効でも確実に更新されるよう 15 秒ポーリング
    const pollId = setInterval(() => {
      if (ticketRef.current) fetchWaitingAhead(ticketRef.current)
    }, 15000)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase.channel(`ticket-${ticket.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'queues', filter: `id=eq.${ticket.id}` },
        payload => setTicket(payload.new as Queue))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${storeId}` },
        () => { if (ticketRef.current) fetchWaitingAhead(ticketRef.current) })
      .subscribe()
    channelRef.current = channel
    return () => {
      clearInterval(pollId)
      supabase.removeChannel(channel)
    }
  }, [ticket?.id, storeId, fetchWaitingAhead])

  const handleRegistered        = (t: Queue) => { setTicket(t); setView('details') }
  const handleDetailsComplete   = (t: Queue) => { setTicket(t); setView('waiting') }
  const handleDetailsSkip       = () => setView('waiting')
  const handleStatusChange = useCallback((s: 'calling' | 'completed' | 'cancelled') => setView(s), [])
  const handleCheckIn      = useCallback(() => setTicket(prev => prev ? { ...prev, checked_in: true } : null), [])
  const handleCustomerCancel = useCallback(async () => {
    if (!ticketRef.current) return
    await supabase.from('queues').update({ status: 'cancelled' }).eq('id', ticketRef.current.id)
    localStorage.removeItem(ticketKey)
    localStorage.removeItem(dateKey)
    setView('self_cancelled')
  }, [ticketKey, dateKey])
  const handleReset = async () => {
    localStorage.removeItem(ticketKey); localStorage.removeItem(dateKey)
    setTicket(null); setWaitingAhead(0)
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const { data: sd } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
    setView(sd && !sd.is_open ? 'closed' : 'register')
  }

  if (view === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-violet-900 to-blue-900 flex items-center justify-center">
      <div className="text-center text-white">
        <Loader2 size={48} className="animate-spin mx-auto mb-4 text-indigo-300" />
        <p className="text-lg font-bold text-white/70">読み込み中...</p>
      </div>
    </div>
  )
  if (view === 'closed')       return <ClosedView />
  if (view === 'add_friend')   return <AddFriendView onAdded={() => setView('register')} />
  if (view === 'crm_register') return (
    <CrmRegisterView storeId={storeId} storeName={storeName} lineProfile={lineProfile} />
  )
  if (view === 'register')   return (
    <RegisterView storeId={storeId} storeName={storeName} onComplete={handleRegistered}
      lineProfile={lineProfile} inLineApp={inLineApp} allowRemote={allowRemote}
      existingCustomers={existingCustomers} />
  )
  if (view === 'details' && ticket) return (
    <DetailsView ticket={ticket} storeId={storeId}
      onComplete={handleDetailsComplete} onSkip={handleDetailsSkip} />
  )
  if (!ticket) return null
  if (view === 'calling')        return <CallingView ticket={ticket} onComplete={() => handleStatusChange('completed')} />
  if (view === 'completed')      return <CompletedView onReset={handleReset} />
  if (view === 'cancelled')      return <CancelledView onReset={handleReset} />
  if (view === 'self_cancelled') return <SelfCancelledView onReset={handleReset} />

  return (
    <WaitingView ticket={ticket} waitingAhead={waitingAhead} waitThresholds={waitThresholds}
      onStatusChange={handleStatusChange} onCheckIn={handleCheckIn} onCancel={handleCustomerCancel}
      storeId={storeId} storeName={storeName} />
  )
}
