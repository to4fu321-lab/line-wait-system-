'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Clock, CheckCircle2, ChevronDown, Loader2, MessageCircle } from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type { Queue, QueueCategory, Gender } from '@/types/database'
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/types/database'
import { initLiff, getLineProfile, isInLineApp, checkFriendship, openAddFriend, type LiffProfile } from '@/lib/liff'

// ============================================================
// 学校リスト（実際の取引校に変更してください）
// ============================================================
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

type PageView = 'loading' | 'add_friend' | 'register' | 'waiting' | 'calling' | 'completed' | 'cancelled' | 'not_found' | 'closed'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

// ============================================================
// 友達追加画面
// ============================================================
function AddFriendView({ onAdded }: { onAdded: () => void }) {
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)
  const addUrl = `https://line.me/R/ti/p/@${LINE_BASIC_ID.replace(/^@/, '')}`

  const handleCheck = async () => {
    setChecking(true)
    setFailed(false)
    try {
      // LINEプロフィールを再取得してサーバーで友達確認
      const profile = await (await import('@/lib/liff')).getLineProfile()
      if (profile?.userId) {
        const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
        const { friend } = await res.json()
        if (friend) { onAdded(); return }
      }
    } catch { /* ignore */ }
    setFailed(true)
    setChecking(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-500 to-green-600 flex flex-col items-center justify-center px-6">
      <div className="text-center text-white mb-8">
        <div className="text-7xl mb-6">💬</div>
        <h1 className="text-3xl font-black mb-3">友達追加が必要です</h1>
        <p className="text-green-100 text-lg">順番が来たらLINEで通知が届きます</p>
      </div>

      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl space-y-4">
        <a
          href={addUrl}
          className="w-full bg-green-500 text-white text-xl font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <MessageCircle size={24} />
          ① 友達追加する
        </a>

        <button
          onClick={handleCheck}
          disabled={checking}
          className="w-full bg-blue-600 text-white text-lg font-bold py-4 rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {checking ? <><Loader2 size={18} className="animate-spin" />確認中...</> : '② 追加済み → 受付へ進む'}
        </button>

        {failed && (
          <p className="text-red-500 text-sm text-center">
            友達追加が確認できません。追加してから②を押してください。
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 受付フォーム画面
// ============================================================
const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male',   label: '男性', icon: '👦' },
  { value: 'female', label: '女性', icon: '👧' },
  { value: 'other',  label: 'その他', icon: '👤' },
]

function RegisterView({
  storeId,
  storeName,
  onComplete,
  lineProfile,
  inLineApp,
}: {
  storeId: string
  storeName: string
  onComplete: (ticket: Queue) => void
  lineProfile: LiffProfile | null
  inLineApp: boolean
}) {
  const [schoolName, setSchoolName] = useState('')
  const [customSchool, setCustomSchool] = useState('')
  const [customerName, setCustomerName] = useState(lineProfile?.displayName ?? '')
  const [childName, setChildName] = useState('')
  const [gender, setGender] = useState<Gender>('other')
  const [category, setCategory] = useState<QueueCategory>('fitting')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCustomInput, setShowCustomInput] = useState(false)

  useEffect(() => {
    if (lineProfile?.displayName && !customerName) {
      setCustomerName(lineProfile.displayName)
    }
  }, [lineProfile, customerName])

  const handleSchoolChange = (val: string) => {
    if (val === 'その他（直接入力）') {
      setShowCustomInput(true)
      setSchoolName('')
    } else {
      setShowCustomInput(false)
      setSchoolName(val)
    }
  }

  const finalSchoolName = showCustomInput ? customSchool : schoolName

  const handleSubmit = async () => {
    if (!finalSchoolName.trim()) {
      setError('学校名を選択または入力してください')
      return
    }
    if (!customerName.trim()) {
      setError('氏名を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: storeData } = await supabase
        .from('stores').select('is_open').eq('id', storeId).single()
      if (storeData && !storeData.is_open) {
        setError('現在受付を停止しています。スタッフにお声がけください。')
        setLoading(false)
        return
      }

      const { data: nextNum, error: rpcErr } = await supabase.rpc('get_next_ticket_number', {
        p_store_id: storeId,
      })
      if (rpcErr) throw rpcErr

      const { data, error: insertErr } = await supabase
        .from('queues')
        .insert({
          store_id: storeId,
          ticket_number: nextNum as number,
          status: 'waiting',
          school_name: finalSchoolName.trim(),
          customer_name: customerName.trim(),
          child_name: childName.trim() || null,
          category,
          gender,
          line_user_id: lineProfile?.userId ?? null,
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      if (!data) throw new Error('データの保存に失敗しました')

      localStorage.setItem(`queue_ticket_id_${storeId}`, data.id)
      localStorage.setItem(`queue_ticket_date_${storeId}`, new Date().toDateString())

      if (data.line_user_id) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId:   data.line_user_id,
            ticketNumber: data.ticket_number,
            customerName: data.customer_name,
            storeName,
            storeId,
            type: 'registered',
          }),
        }).catch(console.error)
      }

      onComplete(data)
    } catch (e) {
      console.error(e)
      setError('受付に失敗しました。もう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col">
      <div className="px-6 pt-10 pb-8 text-center text-white">
        <div className="text-5xl mb-3">🎓</div>
        <h1 className="text-3xl font-black tracking-tight">順番待ち受付</h1>
        {storeName && <p className="text-blue-200 text-base mt-1">{storeName}</p>}
        <p className="text-blue-100 mt-2 text-lg">下記を入力して受付してください</p>

        {lineProfile ? (
          <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-300/30 rounded-full px-4 py-1.5 mt-4 text-sm">
            <MessageCircle size={14} />
            LINE連携済み（{lineProfile.displayName}）
          </div>
        ) : !inLineApp ? (
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-300/30 rounded-full px-4 py-1.5 mt-4 text-xs">
            ⚠️ LINEで開くと呼出通知が届きます
          </div>
        ) : null}
      </div>

      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-10 animate-slide-up">
        <div className="max-w-md mx-auto space-y-6">

          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              学校名 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                className="w-full appearance-none text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 pr-12 focus:border-blue-500 focus:outline-none bg-white text-gray-800 transition-colors"
                value={showCustomInput ? 'その他（直接入力）' : schoolName}
                onChange={e => handleSchoolChange(e.target.value)}
              >
                <option value="">選択してください</option>
                {SCHOOLS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
            {showCustomInput && (
              <input
                type="text"
                className="mt-3 w-full text-lg border-2 border-blue-300 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="学校名を入力してください"
                value={customSchool}
                onChange={e => setCustomSchool(e.target.value)}
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="name"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="例：山田 太郎"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-700 mb-2">
              お子様のお名前
            </label>
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              className="w-full text-lg border-2 border-gray-200 rounded-2xl px-5 py-4 focus:border-blue-500 focus:outline-none transition-colors"
              placeholder="例：山田 花子"
              value={childName}
              onChange={e => setChildName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-700 mb-3">
              性別 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`py-5 rounded-2xl border-2 text-center transition-all active:scale-95 ${
                    gender === opt.value
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-3xl mb-1">{opt.icon}</div>
                  <div className={`text-base font-bold ${gender === opt.value ? 'text-blue-700' : 'text-gray-600'}`}>
                    {opt.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-lg font-bold text-gray-700 mb-3">
              ご用件 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['fitting', 'pickup', 'other'] as QueueCategory[]).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`py-5 rounded-2xl border-2 text-center transition-all active:scale-95 ${
                    category === cat
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="text-3xl mb-1">{CATEGORY_ICONS[cat]}</div>
                  <div className={`text-base font-bold ${category === cat ? 'text-blue-700' : 'text-gray-600'}`}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600">
              <AlertCircle size={20} className="shrink-0" />
              <span className="text-base font-medium">{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white text-2xl font-black py-6 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-3 mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                受付中...
              </>
            ) : (
              '受付する →'
            )}
          </button>

          <p className="text-center text-gray-400 text-sm pt-2">
            受付後は画面を閉じないでください
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 待機状況画面
// ============================================================
function WaitingView({
  ticket,
  waitingAhead,
  onStatusChange,
  storeId,
  storeName,
}: {
  ticket: Queue
  waitingAhead: number
  onStatusChange: (status: 'calling' | 'completed' | 'cancelled') => void
  storeId: string
  storeName: string
}) {
  useEffect(() => {
    if (ticket.status === 'calling') onStatusChange('calling')
    else if (ticket.status === 'completed') onStatusChange('completed')
    else if (ticket.status === 'cancelled') onStatusChange('cancelled')
  }, [ticket.status, onStatusChange])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <div className="bg-blue-600 px-6 py-6 text-center text-white">
        <div className="inline-flex items-center gap-2 bg-blue-500 rounded-full px-4 py-1.5 text-sm font-medium mb-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          リアルタイム更新中
        </div>
        <h1 className="text-2xl font-black">受付完了</h1>
        {storeName && <p className="text-blue-200 text-base mt-1">{storeName}</p>}
      </div>

      <main className="flex-1 flex flex-col items-center px-6 py-8 max-w-md mx-auto w-full">
        <div className="w-full bg-white rounded-3xl shadow-xl p-8 text-center animate-slide-up">
          <p className="text-base text-gray-500 font-medium mb-1">あなたの整理番号</p>
          <div className="ticket-number text-8xl font-black text-blue-600 leading-none tabular-nums">
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>

          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6">
            {waitingAhead === 0 ? (
              <div>
                <p className="text-gray-600 font-medium">まもなくお呼びします</p>
                <p className="text-4xl font-black text-orange-500 mt-1">準備中</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 font-medium">あなたの前の待ち人数</p>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="ticket-number text-6xl font-black text-blue-700">{waitingAhead}</span>
                  <span className="text-2xl font-bold text-blue-500">組</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 bg-gray-50 rounded-2xl p-5 text-left space-y-3">
            <InfoRow label="学校名" value={ticket.school_name} />
            <InfoRow label="氏名" value={`${ticket.customer_name} 様`} />
            {ticket.child_name && (
              <InfoRow label="お子様" value={ticket.child_name} />
            )}
            <InfoRow label="ご用件" value={`${CATEGORY_ICONS[ticket.category]} ${CATEGORY_LABELS[ticket.category]}`} />
          </div>

          {ticket.line_user_id ? (
            <div className="mt-4 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 text-green-700">
              <MessageCircle size={14} />
              <span className="text-sm font-medium">LINEで呼出通知が届きます</span>
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2 text-amber-700">
              <span className="text-sm font-medium">📱 この画面を閉じないでください</span>
            </div>
          )}

          <div className="mt-5">
            <a
              href={`/${storeId}/details?ticketId=${ticket.id}`}
              className="w-full bg-orange-500 text-white text-lg font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              <span>📋</span>
              <span>住所・電話番号を入力する</span>
              <span className="bg-white text-orange-500 text-xs font-black px-2 py-1 rounded-full leading-none">必須</span>
            </a>
            <p className="text-center text-orange-600 text-sm font-medium mt-2">
              ご購入に必要な情報です。必ずご入力ください。
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Clock size={16} className="animate-spin" style={{ animationDuration: '4s' }} />
            <span className="text-sm">リアルタイム更新中</span>
          </div>
        </div>
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-base">{label}</span>
      <span className="font-bold text-gray-800 text-base text-right max-w-[60%]">{value}</span>
    </div>
  )
}

// ============================================================
// 呼出中画面
// ============================================================
function CallingView({ ticket }: { ticket: Queue }) {
  return (
    <div className="min-h-screen bg-yellow-400 animate-pulse-bg flex flex-col items-center justify-center px-6">
      <div className="text-center animate-slide-up">
        <div className="text-7xl mb-4">
          <span className="animate-ring inline-block">🔔</span>
        </div>
        <h2 className="text-5xl font-black text-yellow-900 leading-tight mb-4">
          お呼び<br />しています！
        </h2>
        <p className="text-2xl font-bold text-yellow-800 mb-8">
          カウンターへお越しください
        </p>

        <div className="bg-white rounded-3xl shadow-2xl p-8 inline-block">
          <p className="text-base text-gray-500 mb-1">整理番号</p>
          <div className="ticket-number text-8xl font-black text-blue-600 leading-none">
            {String(ticket.ticket_number).padStart(3, '0')}
          </div>
          <p className="text-xl font-bold text-gray-700 mt-3">
            {ticket.customer_name} 様
          </p>
        </div>

        <p className="mt-8 text-yellow-800 font-bold text-xl">
          {ticket.school_name}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// 完了・不在画面
// ============================================================
function CompletedView({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center px-6">
      <div className="text-center animate-slide-up">
        <CheckCircle2 size={96} className="text-green-500 mx-auto mb-6" />
        <h2 className="text-4xl font-black text-green-800 mb-3">ご対応完了</h2>
        <p className="text-xl text-green-600 mb-10">ありがとうございました！</p>
        <button
          onClick={onReset}
          className="bg-green-500 text-white text-xl font-bold py-5 px-10 rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          最初に戻る
        </button>
      </div>
    </div>
  )
}

function CancelledView({ onReset }: { onReset: () => void }) {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-6">
      <div className="text-center animate-slide-up">
        <div className="text-7xl mb-6">😔</div>
        <h2 className="text-4xl font-black text-gray-700 mb-3">お呼びしましたが</h2>
        <p className="text-xl text-gray-500 mb-3">ご不在のためキャンセルされました</p>
        <p className="text-base text-gray-400 mb-10">再度受付が必要な場合は下のボタンを押してください</p>
        <button
          onClick={onReset}
          className="bg-blue-600 text-white text-xl font-bold py-5 px-10 rounded-2xl shadow-lg active:scale-95 transition-transform"
        >
          もう一度受付する
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 受付停止画面
// ============================================================
function ClosedView() {
  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6">
      <div className="text-center text-white animate-slide-up">
        <div className="text-7xl mb-6">🚪</div>
        <h1 className="text-3xl font-black mb-3">現在受付を停止しています</h1>
        <p className="text-gray-400 text-lg">店頭スタッフにお声がけください</p>
      </div>
    </div>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [view, setView] = useState<PageView>('loading')
  const [ticket, setTicket] = useState<Queue | null>(null)
  const [waitingAhead, setWaitingAhead] = useState(0)
  const [lineProfile, setLineProfile] = useState<LiffProfile | null>(null)
  const [inLineApp, setInLineApp] = useState(false)
  const [storeName, setStoreName] = useState('')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const ticketKey = `queue_ticket_id_${storeId}`
  const dateKey   = `queue_ticket_date_${storeId}`

  // LIFF初期化 → 友達チェック → 画面遷移
  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const savedId   = localStorage.getItem(ticketKey)
      const savedDate = localStorage.getItem(dateKey)
      const hasSavedTicket = savedId && savedDate === new Date().toDateString()

      // 待機中のお客様はis_openチェックをスキップして画面を見続けられるようにする
      if (!hasSavedTicket) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('is_open, name')
          .eq('id', storeId)
          .single()
        if (storeData?.name) setStoreName(storeData.name)
        if (storeData && !storeData.is_open) {
          setView('closed')
          return
        }
      }

      // 保存済みチケットがある場合でも必ずLIFF初期化してprofileを取得
      // （再受付時にline_user_idがnullになるバグを防ぐ）
      const liff   = await initLiff()
      const inLine = isInLineApp()
      setInLineApp(inLine)

      if (liff && inLine) {
        try {
          // login()リダイレクトを避けるため isLoggedIn() で確認してから取得
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile()
            setLineProfile({ userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl })
          }
        } catch { /* ignore */ }
      }

      // 当日のチケットが残っていれば復元（友達チェックはスキップ）
      if (hasSavedTicket) {
        setView('register')
        return
      }

      if (!liff || !inLine) {
        setView('register')
        return
      }

      // 新規訪問者：サーバーサイドAPIで友達確認
      const profile = await getLineProfile()
      if (profile) setLineProfile(profile)

      if (profile?.userId) {
        try {
          const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
          const { friend } = await res.json()
          setView(friend ? 'register' : 'add_friend')
        } catch {
          setView('register')
        }
      } else {
        setView('add_friend')
      }
    })()
  }, [storeId, ticketKey, dateKey])

  // ローカルストレージから当日のチケットを復元
  useEffect(() => {
    if (view !== 'register' || !storeId) return
    const savedId   = localStorage.getItem(ticketKey)
    const savedDate = localStorage.getItem(dateKey)

    if (savedId && savedDate === new Date().toDateString()) {
      supabase
        .from('queues')
        .select('*')
        .eq('id', savedId)
        .single()
        .then(({ data }) => {
          if (data) {
            setTicket(data)
            setView(
              data.status === 'calling'   ? 'calling'   :
              data.status === 'completed' ? 'completed' :
              data.status === 'cancelled' ? 'cancelled' : 'waiting'
            )
          }
        })
    }
  }, [view, storeId, ticketKey, dateKey])

  // 前の待ち人数を取得
  const fetchWaitingAhead = useCallback(async (t: Queue) => {
    const { count } = await supabase
      .from('queues')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId)
      .eq('status', 'waiting')
      .lt('ticket_number', t.ticket_number)
      .gte('created_at', getTodayStart())

    setWaitingAhead(count ?? 0)
  }, [storeId])

  // Realtime サブスクリプション
  useEffect(() => {
    if (!ticket) return

    fetchWaitingAhead(ticket)

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'queues', filter: `id=eq.${ticket.id}` },
        payload => setTicket(payload.new as Queue)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queues', filter: `store_id=eq.${storeId}` },
        () => fetchWaitingAhead(ticket)
      )
      .subscribe()

    channelRef.current = channel

    return () => { supabase.removeChannel(channel) }
  }, [ticket?.id, storeId, fetchWaitingAhead])

  const handleRegistered = (newTicket: Queue) => {
    setTicket(newTicket)
    setView('waiting')
  }

  const handleStatusChange = useCallback((status: 'calling' | 'completed' | 'cancelled') => {
    setView(status)
  }, [])

  const handleReset = async () => {
    localStorage.removeItem(ticketKey)
    localStorage.removeItem(dateKey)
    setTicket(null)
    setWaitingAhead(0)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    const { data: storeData } = await supabase
      .from('stores').select('is_open').eq('id', storeId).single()
    setView(storeData && !storeData.is_open ? 'closed' : 'register')
  }

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" />
          <p className="text-xl font-bold">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (view === 'closed') return <ClosedView />

  if (view === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-black text-gray-700 mb-2">店舗が見つかりません</h1>
          <p className="text-gray-500">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  if (view === 'add_friend') return <AddFriendView onAdded={() => setView('register')} />

  if (view === 'register') {
    return (
      <RegisterView
        storeId={storeId}
        storeName={storeName}
        onComplete={handleRegistered}
        lineProfile={lineProfile}
        inLineApp={inLineApp}
      />
    )
  }

  if (!ticket) return null

  if (view === 'calling')   return <CallingView ticket={ticket} />
  if (view === 'completed') return <CompletedView onReset={handleReset} />
  if (view === 'cancelled') return <CancelledView onReset={handleReset} />

  return (
    <WaitingView
      ticket={ticket}
      waitingAhead={waitingAhead}
      onStatusChange={handleStatusChange}
      storeId={storeId}
      storeName={storeName}
    />
  )
}
