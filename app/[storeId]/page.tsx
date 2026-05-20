'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Clock, CheckCircle2, ChevronDown, Loader2, MessageCircle, MapPin } from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueCategory, Gender, WaitThreshold } from '@/types/database'
import { CATEGORY_LABELS, CATEGORY_ICONS, DEFAULT_THRESHOLDS, getWaitMessage } from '@/types/database'
import { initLiff, getLineProfile, isInLineApp, type LiffProfile } from '@/lib/liff'

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

type PageView = 'loading' | 'add_friend' | 'register' | 'waiting' | 'calling' | 'completed' | 'cancelled' | 'self_cancelled' | 'closed'

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

function RegisterView({ storeId, storeName, onComplete, lineProfile, inLineApp, allowRemote }: {
  storeId: string; storeName: string
  onComplete: (ticket: Queue) => void
  lineProfile: LiffProfile | null; inLineApp: boolean
  allowRemote: boolean
}) {
  const [schoolName,      setSchoolName]      = useState('')
  const [customSchool,    setCustomSchool]    = useState('')
  const [customerName,    setCustomerName]    = useState(lineProfile?.displayName ?? '')
  const [childName,       setChildName]       = useState('')
  const [height,          setHeight]          = useState('')
  const [weight,          setWeight]          = useState('')
  const [parentPhone,     setParentPhone]     = useState('')
  const [gender,          setGender]          = useState<Gender>('other')
  const [category,        setCategory]        = useState<QueueCategory>('fitting')
  const [isRemote,        setIsRemote]        = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [waitingCount,    setWaitingCount]    = useState<number | null>(null)

  useEffect(() => {
    if (lineProfile?.displayName && !customerName) setCustomerName(lineProfile.displayName)
  }, [lineProfile, customerName])

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
    if (!customerName.trim())    { setError('氏名を入力してください'); return }
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
        child_name: childName.trim() || null, category, gender,
        line_user_id: lineProfile?.userId ?? null,
        is_remote: isRemote, checked_in: !isRemote,
        details: (height || weight || parentPhone) ? {
          ...(height      ? { height }      : {}),
          ...(weight      ? { weight }      : {}),
          ...(parentPhone ? { parentPhone } : {}),
        } : null,
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
      <div className="px-6 pt-8 pb-6 text-center text-white">
        <h1 className="text-2xl font-black tracking-tight">順番待ち受付</h1>
        {storeName && <p className="text-indigo-200 text-sm mt-0.5">{storeName}</p>}
        {lineProfile ? (
          <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5 mt-3 text-xs">
            <MessageCircle size={11} />LINE連携済み（{lineProfile.displayName}）
          </div>
        ) : !inLineApp ? (
          <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-300/30 rounded-full px-3 py-1.5 mt-3 text-xs">
            ⚠️ LINEで開くと呼出通知が届きます
          </div>
        ) : null}
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-5 pt-6 pb-10 animate-slide-up shadow-2xl">
        <div className="max-w-md mx-auto space-y-5">

          {/* 現在の待ち人数 */}
          {waitingCount !== null && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3.5">
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wide">現在の待ち人数</p>
                <p className="text-3xl font-black text-indigo-700 leading-none mt-0.5">
                  {waitingCount}<span className="text-sm font-bold text-indigo-500 ml-1">組</span>
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          )}

          <FormField label="学校名" required>
            <div className="relative">
              <select
                className="w-full appearance-none text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 pr-10 focus:border-indigo-400 focus:bg-white focus:outline-none text-gray-800 transition-all"
                value={showCustomInput ? 'その他（直接入力）' : schoolName}
                onChange={e => handleSchoolChange(e.target.value)}
              >
                <option value="">選択してください</option>
                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
            </div>
            {showCustomInput && (
              <input type="text"
                className="mt-2 w-full text-base border-2 border-indigo-200 bg-indigo-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:outline-none transition-all"
                placeholder="学校名を入力してください"
                value={customSchool}
                onChange={e => { setCustomSchool(e.target.value); setError(null) }}
                autoFocus />
            )}
          </FormField>

          <FormField label="氏名" required>
            <input type="text" inputMode="text" autoComplete="name"
              className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
              placeholder="例：山田 太郎"
              value={customerName}
              onChange={e => { setCustomerName(e.target.value); setError(null) }} />
          </FormField>

          <FormField label="お子様のお名前">
            <input type="text" inputMode="text" autoComplete="off"
              className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
              placeholder="例：山田 花子"
              value={childName}
              onChange={e => setChildName(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="身長（cm）">
              <input type="number" inputMode="numeric"
                className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：155"
                value={height}
                onChange={e => setHeight(e.target.value)} />
            </FormField>
            <FormField label="体重（kg）">
              <input type="number" inputMode="numeric"
                className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                placeholder="例：50"
                value={weight}
                onChange={e => setWeight(e.target.value)} />
            </FormField>
          </div>

          <FormField label="保護者の電話番号">
            <input type="tel" inputMode="tel" autoComplete="tel"
              className="w-full text-base border-2 border-gray-100 bg-gray-50 rounded-xl px-4 py-3.5 focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
              placeholder="例：090-1234-5678"
              value={parentPhone}
              onChange={e => setParentPhone(e.target.value)} />
          </FormField>

          <FormField label="性別" required>
            <div className="grid grid-cols-3 gap-2">
              {GENDER_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setGender(opt.value)}
                  className={`py-3.5 rounded-xl border-2 text-center transition-all active:scale-95 ${
                    gender === opt.value ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <div className="text-2xl mb-0.5">{opt.icon}</div>
                  <div className={`text-sm font-bold ${gender === opt.value ? 'text-indigo-700' : 'text-gray-500'}`}>{opt.label}</div>
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="ご用件" required>
            <div className="grid grid-cols-3 gap-2">
              {(['fitting', 'pickup', 'other'] as QueueCategory[]).map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`py-3.5 rounded-xl border-2 text-center transition-all active:scale-95 ${
                    category === cat ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100' : 'border-gray-100 bg-gray-50'
                  }`}>
                  <div className="text-2xl mb-0.5">{CATEGORY_ICONS[cat]}</div>
                  <div className={`text-sm font-bold ${category === cat ? 'text-indigo-700' : 'text-gray-500'}`}>{CATEGORY_LABELS[cat]}</div>
                </button>
              ))}
            </div>
          </FormField>

          {/* 遠隔チェックイントグル */}
          {allowRemote && (
            <FormField label="来店方法">
              <button type="button" onClick={() => setIsRemote(v => !v)}
                className={`w-full py-4 rounded-2xl border-2 text-left px-5 transition-all active:scale-[0.98] ${
                  isRemote ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-gray-50'
                }`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`font-bold text-base ${isRemote ? 'text-indigo-700' : 'text-gray-700'}`}>
                      🏠 遠隔チェックイン
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">今すぐ来店しない（自宅・外出先から順番取り）</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${isRemote ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow transition-transform ${isRemote ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </button>
              {isRemote && (
                <p className="text-xs text-indigo-600 font-medium mt-2 px-1">
                  ※ 店舗に到着したら「チェックイン」ボタンを押してください。チェックイン後に呼び出しの対象となります。
                </p>
              )}
            </FormField>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600">
              <AlertCircle size={18} className="shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          <button type="button" onClick={handleSubmit} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xl font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3">
            {loading ? <><Loader2 size={20} className="animate-spin" />受付中...</> : '受付する →'}
          </button>

          <p className="text-center text-gray-400 text-xs">
            {isRemote ? '遠隔モードで受付します。到着後に「チェックイン」を押してください。' : '受付後は画面を閉じないでください'}
          </p>
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

        {/* 現地受付 — 詳細情報入力 */}
        {!ticket.is_remote && (
          <div className="w-full mt-4 animate-fade-in">
            <a href={`/${storeId}/details?ticketId=${ticket.id}`}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg font-black py-5 rounded-2xl shadow-2xl shadow-orange-900/50 flex items-center justify-center gap-3 active:scale-95 transition-all">
              <span>📋</span><span>住所・電話番号を入力する</span>
              <span className="bg-white text-orange-500 text-xs font-black px-2 py-1 rounded-full">必須</span>
            </a>
            <p className="text-center text-orange-200/80 text-sm font-medium mt-2">ご購入に必要な情報です。必ずご入力ください。</p>
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
// メインコンポーネント
// ============================================================
export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [view,           setView]           = useState<PageView>('loading')
  const [ticket,         setTicket]         = useState<Queue | null>(null)
  const [waitingAhead,   setWaitingAhead]   = useState(0)
  const [lineProfile,    setLineProfile]    = useState<LiffProfile | null>(null)
  const [inLineApp,      setInLineApp]      = useState(false)
  const [storeName,      setStoreName]      = useState('')
  const [waitThresholds, setWaitThresholds] = useState<WaitThreshold[]>(DEFAULT_THRESHOLDS)
  const [allowRemote,    setAllowRemote]    = useState(false)
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

      // 受付済みでも常に最新設定を取得（wait_thresholds の変更を反映させるため）
      const { data: sd } = await supabase.from('stores')
        .select('is_open, name, wait_thresholds, allow_remote').eq('id', storeId).single()
      if (sd?.name)            setStoreName(sd.name)
      if (Array.isArray(sd?.wait_thresholds) && sd.wait_thresholds.length > 0)
        setWaitThresholds(sd.wait_thresholds as WaitThreshold[])
      if (sd?.allow_remote != null) setAllowRemote(sd.allow_remote)
      if (!hasSavedTicket && sd && !sd.is_open) { setView('closed'); return }

      const liff   = await initLiff()
      const inLine = isInLineApp()
      setInLineApp(inLine)

      if (liff && inLine) {
        try {
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile()
            setLineProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl })
          }
        } catch { /* ignore */ }
      }

      if (hasSavedTicket) { setView('register'); return }
      if (!liff || !inLine) { setView('register'); return }

      const profile = await getLineProfile()
      if (profile) setLineProfile(profile)

      if (profile?.userId) {
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

  const handleRegistered   = (t: Queue) => { setTicket(t); setView('waiting') }
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
  if (view === 'closed')     return <ClosedView />
  if (view === 'add_friend') return <AddFriendView onAdded={() => setView('register')} />
  if (view === 'register')   return (
    <RegisterView storeId={storeId} storeName={storeName} onComplete={handleRegistered}
      lineProfile={lineProfile} inLineApp={inLineApp} allowRemote={allowRemote} />
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
