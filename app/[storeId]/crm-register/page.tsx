'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, AlertCircle, Plus, User, ChevronRight, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile, openAddFriend } from '@/lib/liff'
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

  const [view,            setView]            = useState<View>('loading')
  const [lineUserId,      setLineUserId]      = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  const [storeName,       setStoreName]       = useState('')
  const [existingList,    setExistingList]    = useState<Customer[]>([])

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
      const { data: sd } = await supabase.from('stores').select('name').eq('id', storeId).single()
      if (sd?.name) setStoreName(sd.name)

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

  const handleRegister = async () => {
    if (!name.trim() || !lineUserId) return
    setSaving(true); setErrorMsg('')
    const { error } = await supabase.from('customers').insert({
      store_id:     storeId,
      name:         name.trim(),
      kana:         kana.trim() || null,
      parent_name:  parentName.trim() || null,
      tel:          tel.trim() || null,
      school_name:  finalSchool.trim() || null,
      line_user_id: lineUserId,
    })
    setSaving(false)
    if (error) {
      setErrorMsg(error.message.includes('unique')
        ? '同じお名前のお子様が既に登録されています'
        : '登録に失敗しました。もう一度お試しください。')
      return
    }
    setDoneName(name.trim())
    setView('done')
  }

  const handleSelectExisting = (customer: Customer) => {
    setConfirmCustomer(customer)
    setView('confirm')
  }

  const handleConfirm = () => {
    if (!confirmCustomer) return
    setDoneName(confirmCustomer.name)
    setView('done')
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-screen bg-[#06C755] flex items-center justify-center">
      <Loader2 size={44} className="animate-spin text-white" />
    </div>
  )

  // ── 友達追加が必要 ────────────────────────────
  if (view === 'add_friend') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
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
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 text-white text-center gap-4">
      <MessageCircle size={64} className="opacity-80" />
      <div>
        <h1 className="text-2xl font-black mb-2">LINEで開いてください</h1>
        <p className="text-green-100 text-base">スタッフのQRコードをLINEカメラで<br />読み取ってください</p>
      </div>
    </div>
  )

  // ── 確認 ──────────────────────────────────────
  if (view === 'confirm' && confirmCustomer) return (
    <div className="min-h-screen bg-[#06C755] flex flex-col items-center justify-center px-6 gap-6">
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
        <button onClick={handleConfirm}
          className="w-full bg-[#06C755] text-white text-lg font-black py-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-green-200">
          はい、これで進む
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

  // ── 登録済みお子様一覧 ─────────────────────────
  if (view === 'existing') return (
    <div className="min-h-screen bg-[#06C755] flex flex-col px-5 pt-12 pb-8">
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
    <div className="min-h-screen bg-[#06C755] flex flex-col px-5 pt-10 pb-8">
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
