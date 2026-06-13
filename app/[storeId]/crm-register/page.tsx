'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, AlertCircle, Plus, User, ChevronRight, ChevronDown, ClipboardList } from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import { initLiff, getLineProfile, openAddFriend } from '@/lib/liff'
import { resolveFeature } from '@/lib/features'
import type { Customer } from '@/types/crm'

type View = 'loading' | 'add_friend' | 'existing' | 'new_form' | 'confirm' | 'done' | 'not_line'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

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

function toKatakana(str: string): string {
  return str.replace(/[ぁ-ゖ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  )
}

export default function CrmRegisterPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [view,            setView]            = useState<View>('loading')
  const [lineUserId,      setLineUserId]      = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  const [storeName,       setStoreName]       = useState('')
  const [existingList,    setExistingList]    = useState<Customer[]>([])
  // 店舗機能フラグ（受付番号発行・セルフ依頼入力）
  const [queueEnabled,      setQueueEnabled]      = useState(false)
  const [selfIntakeEnabled, setSelfIntakeEnabled] = useState(false)

  // フォームフィールド
  const [name,            setName]            = useState('')
  const [kana,            setKana]            = useState('')
  const [parentName,      setParentName]      = useState('')
  const [tel,             setTel]             = useState('')
  const [schoolName,      setSchoolName]      = useState('')
  const [customSchool,    setCustomSchool]    = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const [saving,          setSaving]          = useState(false)
  const [errorMsg,        setErrorMsg]        = useState('')
  const [doneName,        setDoneName]        = useState('')
  const [ticketNumber,    setTicketNumber]    = useState<number | null>(null)
  const [doneCustomerId,  setDoneCustomerId]  = useState<string | null>(null)
  const [confirmCustomer, setConfirmCustomer] = useState<Customer | null>(null)
  const [checking,        setChecking]        = useState(false)
  const [friendFailed,    setFriendFailed]    = useState(false)

  const kanaEditedRef = useRef(false)

  const finalSchool = showCustomInput ? customSchool : schoolName

  const handleNameChange = (val: string) => {
    setName(val)
    if (!kanaEditedRef.current) setKana(toKatakana(val))
  }

  const handleKanaChange = (val: string) => {
    kanaEditedRef.current = true
    setKana(val)
  }

  const handleSchoolChange = (val: string) => {
    if (val === 'その他（直接入力）') { setShowCustomInput(true); setSchoolName('') }
    else { setShowCustomInput(false); setSchoolName(val) }
  }

  const loadCustomerView = async (userId: string, displayName: string) => {
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('store_id', storeId)
      .eq('line_user_id', userId)
      .order('created_at', { ascending: true })

    if (existing && existing.length > 0) {
      const list = existing as Customer[]
      setExistingList(list)
      // 登録済みデータから保護者情報を事前入力
      const first = list[0]
      if (first.parent_name) setParentName(first.parent_name)
      if (first.tel)         setTel(first.tel)
      if (first.school_name) {
        if (SCHOOLS.includes(first.school_name)) {
          setSchoolName(first.school_name); setShowCustomInput(false)
        } else {
          setCustomSchool(first.school_name); setShowCustomInput(true)
        }
      }
      setView('existing')
    } else {
      setName(displayName)
      setKana(toKatakana(displayName))
      setView('new_form')
    }
  }

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const { data: sd } = await (supabase as any).from('stores').select('name, features').eq('id', storeId).single()
      if (sd?.name) setStoreName(sd.name)
      const features = (sd?.features ?? {}) as Record<string, unknown>
      setQueueEnabled(resolveFeature('tab_queue', features))
      setSelfIntakeEnabled(resolveFeature('customer_self_intake', features))

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
        setLineDisplayName(profile.displayName ?? '')

        const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
        const { friend } = await res.json()
        if (!friend) { setView('add_friend'); return }

        await loadCustomerView(profile.userId, profile.displayName ?? '')
      } catch {
        setView('not_line')
      }
    })()
  }, [storeId])

  const handleProceedAfterFriend = async () => {
    if (!lineUserId) return
    setChecking(true); setFriendFailed(false)
    try {
      const res = await fetch(`/api/check-friend?userId=${lineUserId}`)
      const { friend } = await res.json()
      if (friend) {
        await loadCustomerView(lineUserId, lineDisplayName)
      } else {
        setFriendFailed(true)
      }
    } catch { setFriendFailed(true) }
    setChecking(false)
  }

  // 受付チケットの確保:
  // 当日の待機・呼出中チケットがあれば顧客を紐付けて番号を再利用、
  // なければ新規発行（受付番号で店側端末に即時表示される）
  const ensureTicket = async (cust: Customer): Promise<number | null> => {
    if (!queueEnabled || !lineUserId) return null
    try {
      const { data: existing } = await supabase.from('queues')
        .select('id, ticket_number')
        .eq('store_id', storeId)
        .eq('line_user_id', lineUserId)
        .in('status', ['waiting', 'calling'])
        .gte('created_at', getTodayStart())
        .order('created_at', { ascending: false })

      if (existing && existing.length > 0) {
        await supabase.from('queues')
          .update({ customer_name: cust.name, customer_id: cust.id })
          .in('id', existing.map(e => e.id))
        return existing[0].ticket_number
      }

      const { data: nextNum, error: numErr } = await supabase
        .rpc('get_next_ticket_number', { p_store_id: storeId })
      if (numErr || nextNum == null) return null

      const { data: t, error } = await supabase.from('queues').insert({
        store_id:      storeId,
        ticket_number: nextNum as number,
        status:        'waiting',
        customer_name: cust.name,
        school_name:   cust.school_name ?? null,
        category:      'other',
        gender:        (cust.gender === 'male' || cust.gender === 'female') ? cust.gender : 'other',
        line_user_id:  lineUserId,
        is_remote:     false,
        checked_in:    true,
        customer_id:   cust.id,
        details:       { source: 'crm_register' },
      }).select('ticket_number').single()
      if (error || !t) return null

      // LINE・管理者端末への通知はベストエフォート
      fetch('/api/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId, ticketNumber: t.ticket_number,
          customerName: cust.name, storeId, type: 'registered',
        }),
      }).catch(() => {})
      fetch('/api/push-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          type:  'queue_new',
          title: `📱 新規登録 No.${String(t.ticket_number).padStart(3, '0')}`,
          body:  `${cust.name} 様が登録完了しました`,
          url:   `/${storeId}/admin`,
        }),
      }).catch(() => {})

      return t.ticket_number
    } catch { return null }
  }

  const handleRegister = async () => {
    if (!name.trim() || !lineUserId) return
    setSaving(true); setErrorMsg('')
    const { data: newCust, error } = await supabase.from('customers').insert({
      store_id:     storeId,
      name:         name.trim(),
      kana:         kana.trim() || null,
      parent_name:  parentName.trim() || null,
      tel:          tel.trim() || null,
      school_name:  finalSchool.trim() || null,
      line_user_id: lineUserId,
    }).select().single()
    if (error) {
      setSaving(false)
      setErrorMsg(error.message.includes('unique')
        ? '同じお名前のお子様が既に登録されています'
        : '登録に失敗しました。もう一度お試しください。')
      return
    }
    // 当日チケットへの紐付け or 受付番号の新規発行
    const tn = newCust ? await ensureTicket(newCust as Customer) : null
    setSaving(false)
    setTicketNumber(tn)
    setDoneCustomerId(newCust?.id ?? null)
    setDoneName(name.trim())
    setView('done')
  }

  const handleSelectExisting = (customer: Customer) => {
    setConfirmCustomer(customer)
    setView('confirm')
  }

  const handleConfirm = async () => {
    if (!confirmCustomer || saving) return
    setSaving(true)
    const tn = await ensureTicket(confirmCustomer)
    setSaving(false)
    setTicketNumber(tn)
    setDoneCustomerId(confirmCustomer.id)
    setDoneName(confirmCustomer.name)
    setView('done')
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  // ── 友達追加が必要 ────────────────────────────
  if (view === 'add_friend') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center text-white">
        <MessageCircle size={64} className="mx-auto mb-3 opacity-90" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black mb-2">友達追加が必要です</h1>
        <p className="text-green-100 text-sm leading-relaxed">
          お直しの受付完了・お呼び出しの通知を<br />LINEで受け取るために必要です
        </p>
      </div>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <button onClick={() => openAddFriend(LINE_BASIC_ID)}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          <MessageCircle size={20} />① 友達追加する
        </button>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-xs leading-relaxed">
          ✂️ 友達追加後にLINEが届いたら<br />
          <span className="font-bold">「お直し登録」ボタン</span>を押してください
        </div>
        <button onClick={handleProceedAfterFriend} disabled={checking}
          className="w-full bg-zinc-100 text-zinc-700 text-base font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60">
          {checking ? <><Loader2 size={16} className="animate-spin" />確認中...</> : '② 追加済み → 登録へ進む'}
        </button>
        {friendFailed && (
          <p className="text-red-500 text-xs text-center">
            友達追加が確認できません。追加してから②を押してください。
          </p>
        )}
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

  // ── 確認 ──────────────────────────────────────
  if (view === 'confirm' && confirmCustomer) return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
      <div className="text-center text-white">
        <MessageCircle size={48} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">お名前の確認</h1>
      </div>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-5">
        <div>
          <p className="text-zinc-500 text-sm mb-3">こちらのお名前でよろしいですか？</p>
          <div className="flex items-center justify-center gap-3 bg-green-50 rounded-2xl px-5 py-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-[#06C755]" />
            </div>
            <p className="text-2xl font-black text-zinc-900">{confirmCustomer.name}</p>
          </div>
          {confirmCustomer.kana && <p className="text-zinc-400 text-sm mt-1">{confirmCustomer.kana}</p>}
          {confirmCustomer.school_name && <p className="text-zinc-400 text-xs mt-1">{confirmCustomer.school_name}</p>}
        </div>
        <button onClick={handleConfirm} disabled={saving}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-green-200 disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={20} className="animate-spin" />受付中...</> : 'はい、これで進む'}
        </button>
        <button onClick={() => { setConfirmCustomer(null); setView('existing') }}
          className="w-full text-zinc-400 text-sm py-2 hover:text-zinc-600 transition-colors">
          ← 戻る
        </button>
      </div>
    </div>
  )

  // ── 完了 ──────────────────────────────────────
  if (view === 'done') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-5">
      <CheckCircle2 size={72} />
      <div>
        <h1 className="text-3xl font-black mb-2">確認しました！</h1>
        <p className="text-2xl font-bold mb-1">{doneName} 様</p>
      </div>

      {ticketNumber != null ? (
        <div className="bg-white rounded-3xl px-8 py-6 shadow-2xl w-full max-w-sm">
          <p className="text-zinc-500 text-xs font-bold mb-1">受付番号</p>
          <p className="ticket-number text-6xl font-black text-[#06C755] leading-none tracking-tight">
            {String(ticketNumber).padStart(3, '0')}
          </p>
          <p className="text-zinc-500 text-sm mt-3 leading-relaxed">
            この画面をスタッフにお見せください。<br />
            店側の端末にも自動で表示されています。
          </p>
        </div>
      ) : (
        <div className="bg-white/20 rounded-2xl px-6 py-4 text-green-100 text-base leading-relaxed">
          <p className="font-bold">スタッフにお声がけください</p>
          <p className="text-sm mt-1 opacity-80">受付を行います</p>
        </div>
      )}

      {selfIntakeEnabled && doneCustomerId && (
        <button
          onClick={() => router.push(`/${storeId}/intake?c=${doneCustomerId}`)}
          className="w-full max-w-sm bg-white/15 border-2 border-white/50 rounded-2xl py-4 flex items-center justify-center gap-2 text-white font-black text-base active:scale-[0.98] transition-all">
          <ClipboardList size={18} />続けて依頼内容を入力する
        </button>
      )}
    </div>
  )

  // ── 登録済みお子様一覧 ─────────────────────────
  if (view === 'existing') return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col px-5 pt-12 pb-8">
      <div className="text-white text-center mb-6">
        <MessageCircle size={44} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">登録済みのお子様</h1>
        <p className="text-green-100 text-sm mt-1">お名前を選択してください</p>
      </div>
      <div className="space-y-3 mb-4">
        {existingList.map(c => (
          <button key={c.id} onClick={() => handleSelectExisting(c)}
            className="w-full bg-white rounded-2xl px-5 py-4 flex items-center gap-3 active:scale-[0.98] transition-all shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <User size={18} className="text-[#06C755]" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-black text-zinc-900 text-base truncate">{c.name}</p>
              {c.kana && <p className="text-zinc-400 text-xs">{c.kana}</p>}
              {c.school_name && <p className="text-zinc-400 text-xs truncate">{c.school_name}</p>}
            </div>
            <ChevronRight size={18} className="text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
      <button onClick={() => { setName(''); setKana(''); kanaEditedRef.current = false; setView('new_form') }}
        className="w-full bg-white/20 border-2 border-white/40 rounded-2xl py-4 flex items-center justify-center gap-2 text-white font-bold text-base active:scale-[0.98] transition-all">
        <Plus size={18} />別のお子様を新規登録
      </button>
    </div>
  )

  // ── 新規登録フォーム ───────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#06C755] flex flex-col px-5 pt-10 pb-8">
      <div className="text-center text-white mb-6">
        <MessageCircle size={40} className="mx-auto mb-2" />
        {storeName && <p className="text-green-200 text-xs font-bold mb-1">{storeName}</p>}
        <h1 className="text-2xl font-black">お子様の登録</h1>
        <p className="text-green-100 text-sm mt-1">
          {lineDisplayName ? `${lineDisplayName} さんのLINEで登録します` : 'LINEで顧客登録を行います'}
        </p>
      </div>

      <div className="bg-white rounded-3xl p-5 w-full shadow-2xl space-y-4">

        {/* お子様のお名前 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">お子様のお名前 <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => handleNameChange(e.target.value)}
            placeholder="例：山田 花子"
            className="w-full text-base font-bold text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        {/* フリガナ（自動変換） */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">フリガナ（お子様）</label>
          <input type="text" value={kana} onChange={e => handleKanaChange(e.target.value)}
            placeholder="ヤマダ ハナコ"
            className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        {/* 保護者名 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">保護者のお名前</label>
          <input type="text" value={parentName} onChange={e => setParentName(e.target.value)}
            placeholder="例：山田 太郎"
            className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        {/* 電話番号 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">電話番号</label>
          <input type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)}
            placeholder="例：090-1234-5678"
            className="w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all" />
        </div>

        {/* 学校名 */}
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">学校名</label>
          <div className="relative">
            <select value={showCustomInput ? 'その他（直接入力）' : schoolName}
              onChange={e => handleSchoolChange(e.target.value)}
              className="w-full appearance-none text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 pr-9 focus:border-[#06C755] focus:bg-white focus:outline-none transition-all">
              <option value="">選択してください</option>
              {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          </div>
          {showCustomInput && (
            <input type="text" value={customSchool} onChange={e => setCustomSchool(e.target.value)}
              placeholder="学校名を入力してください"
              className="mt-1.5 w-full text-base text-zinc-900 border-2 border-zinc-200 bg-zinc-50 rounded-xl px-3 py-2.5 focus:border-[#06C755] focus:outline-none transition-all"
              autoFocus />
          )}
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
          <button onClick={() => setView('existing')}
            className="w-full text-zinc-400 text-sm py-2 hover:text-zinc-600 transition-colors">
            ← 登録済みのお子様に戻る
          </button>
        )}
      </div>
    </div>
  )
}
