'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, AlertCircle, ChevronDown, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile, openAddFriend } from '@/lib/liff'
import { useStoreTheme } from '@/lib/theme-context'

type View = 'loading' | 'add_friend' | 'form' | 'saving' | 'done' | 'not_line'

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

export default function OnboardingPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const theme = useStoreTheme()

  const [view,            setView]            = useState<View>('loading')
  const [lineUserId,      setLineUserId]      = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')

  const [name,            setName]            = useState('')
  const [kana,            setKana]            = useState('')
  const [parentName,      setParentName]      = useState('')
  const [tel,             setTel]             = useState('')
  const [schoolName,      setSchoolName]      = useState('')
  const [customSchool,    setCustomSchool]    = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  const [errorMsg,        setErrorMsg]        = useState('')
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

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
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

        // 既存顧客チェック → 既登録ならホームへ
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('store_id',     storeId)
          .eq('line_user_id', profile.userId)
          .limit(1)
        if (existing && existing.length > 0) {
          router.replace(`/${storeId}/home`)
          return
        }

        // 初期値：LINE 表示名を仮置き
        setName(profile.displayName ?? '')
        setKana(toKatakana(profile.displayName ?? ''))
        setView('form')
      } catch {
        setView('not_line')
      }
    })()
  }, [storeId, router])

  const handleProceedAfterFriend = async () => {
    if (!lineUserId) return
    setChecking(true); setFriendFailed(false)
    try {
      const res = await fetch(`/api/check-friend?userId=${lineUserId}`)
      const { friend } = await res.json()
      if (friend) {
        setName(lineDisplayName)
        setKana(toKatakana(lineDisplayName))
        setView('form')
      } else {
        setFriendFailed(true)
      }
    } catch { setFriendFailed(true) }
    setChecking(false)
  }

  const handleRegister = async () => {
    if (!name.trim() || !lineUserId) return
    setView('saving'); setErrorMsg('')
    const { error } = await supabase.from('customers').insert({
      store_id:     storeId,
      name:         name.trim(),
      kana:         kana.trim() || null,
      parent_name:  parentName.trim() || null,
      tel:          tel.trim() || null,
      school_name:  finalSchool.trim() || null,
      line_user_id: lineUserId,
    })
    if (error) {
      setErrorMsg(error.message.includes('unique')
        ? '同じお名前のお子様が既に登録されています'
        : '登録に失敗しました。もう一度お試しください。')
      setView('form')
      return
    }
    setView('done')
  }

  // ── 共通: グラスカード ─────────────────────────
  const cardStyle: React.CSSProperties = {
    boxShadow: `
      0 24px 60px -20px rgb(${theme.colors.primaryRgb} / 0.22),
      0 1px 0 0 rgb(255 255 255 / 0.65) inset
    `,
  }
  const inputBase = "w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all"
  const focusRing: React.CSSProperties = {
    // focus 時のボーダー色は Tailwind の任意値で
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading' || view === 'saving') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div
        className="w-12 h-12 rounded-full border-4 border-white/40 border-t-transparent animate-spin"
        style={{ borderTopColor: theme.colors.primary }}
      />
      <p className="text-sm text-zinc-500">
        {view === 'saving' ? '登録中…' : '読み込み中…'}
      </p>
    </div>
  )

  // ── LINE 未使用 ───────────────────────────────
  if (view === 'not_line') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <MessageCircle size={56} style={{ color: theme.colors.primary }} />
      <div>
        <h1 className="text-xl font-bold mb-1 text-zinc-900">LINEで開いてください</h1>
        <p className="text-sm text-zinc-500">店舗のQRコードをLINEで読み取ってください</p>
      </div>
    </div>
  )

  // ── 友達追加 ──────────────────────────────────
  if (view === 'add_friend') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 gap-6">
      <div className="text-center">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            boxShadow: `0 16px 40px -12px rgb(${theme.colors.primaryRgb} / 0.5)`,
          }}
        >
          <MessageCircle size={32} className="text-white" />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>
          {theme.storeName}
        </p>
        <h1 className="text-2xl font-black mb-2 text-zinc-900">
          友達追加が必要です
        </h1>
        <p className="text-zinc-500 text-sm leading-relaxed">
          受付完了・お呼び出しの通知を<br />LINE で受け取るために必要です
        </p>
      </div>

      <div
        className="bg-white/75 backdrop-blur-2xl rounded-3xl p-6 w-full max-w-sm border border-white/60 space-y-4"
        style={cardStyle}
      >
        <button
          onClick={() => openAddFriend(LINE_BASIC_ID)}
          className="w-full bg-[#06C755] text-white text-base font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200"
        >
          <MessageCircle size={20} />① LINE で友達追加
        </button>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-xs leading-relaxed">
          ✨ 追加後に LINE が届いたら<br />
          <span className="font-bold">「お直し登録」ボタン</span>を押してから②へ
        </div>

        <button
          onClick={handleProceedAfterFriend}
          disabled={checking}
          className="w-full text-white text-base font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
            boxShadow: `0 8px 24px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
          }}
        >
          {checking
            ? <><Loader2 size={16} className="animate-spin" />確認中...</>
            : <>② 追加済み → 登録へ進む</>}
        </button>

        {friendFailed && (
          <p className="text-red-500 text-xs text-center">
            友達追加が確認できません。追加してから②を押してください。
          </p>
        )}
      </div>
    </main>
  )

  // ── 完了 ─────────────────────────────────────
  if (view === 'done') return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
          boxShadow: `0 20px 50px -12px rgb(${theme.colors.primaryRgb} / 0.55)`,
        }}
      >
        <CheckCircle2 size={56} className="text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-black mb-2 text-zinc-900">登録完了！</h1>
        <p className="text-base text-zinc-600">
          <span className="font-bold">{name.trim()}</span> 様
        </p>
      </div>
      <button
        onClick={() => router.replace(`/${storeId}/home`)}
        className="px-8 py-4 rounded-2xl text-white text-base font-bold active:scale-95 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)`,
        }}
      >
        ホームへ進む →
      </button>
    </main>
  )

  // ── 登録フォーム ──────────────────────────────
  return (
    <main className="min-h-screen px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div
          className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`,
            boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)`,
          }}
        >
          <Sparkles size={26} className="text-white" />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>
          {theme.storeName}
        </p>
        <h1 className="text-2xl font-black text-zinc-900">お子様の情報登録</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {lineDisplayName ? `${lineDisplayName} さんのLINEで登録` : '初回のみご入力ください'}
        </p>
      </div>

      <div
        className="bg-white/75 backdrop-blur-2xl rounded-3xl border border-white/60 p-5 space-y-4"
        style={cardStyle}
      >
        <FormField label="お子様のお名前" required>
          <input
            type="text" value={name} onChange={e => handleNameChange(e.target.value)}
            placeholder="例：山田 花子"
            className={inputBase}
            style={{
              outlineColor: theme.colors.primary,
            }}
            onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
            onBlur={e => (e.currentTarget.style.borderColor = '')}
          />
        </FormField>

        <FormField label="フリガナ（お子様）">
          <input
            type="text" value={kana} onChange={e => handleKanaChange(e.target.value)}
            placeholder="ヤマダ ハナコ"
            className={inputBase}
            onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
            onBlur={e => (e.currentTarget.style.borderColor = '')}
          />
        </FormField>

        <FormField label="保護者のお名前">
          <input
            type="text" value={parentName} onChange={e => setParentName(e.target.value)}
            placeholder="例：山田 太郎"
            className={inputBase}
            onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
            onBlur={e => (e.currentTarget.style.borderColor = '')}
          />
        </FormField>

        <FormField label="電話番号">
          <input
            type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)}
            placeholder="例：090-1234-5678"
            className={inputBase}
            onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
            onBlur={e => (e.currentTarget.style.borderColor = '')}
          />
        </FormField>

        <FormField label="学校名">
          <div className="relative">
            <select
              value={showCustomInput ? 'その他（直接入力）' : schoolName}
              onChange={e => handleSchoolChange(e.target.value)}
              className={`${inputBase} appearance-none pr-9`}
              onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
              onBlur={e => (e.currentTarget.style.borderColor = '')}
            >
              <option value="">選択してください</option>
              {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          </div>
          {showCustomInput && (
            <input
              type="text" value={customSchool} onChange={e => setCustomSchool(e.target.value)}
              placeholder="学校名を入力してください"
              className={`${inputBase} mt-2`}
              autoFocus
              onFocus={e => (e.currentTarget.style.borderColor = theme.colors.primary)}
              onBlur={e => (e.currentTarget.style.borderColor = '')}
            />
          )}
        </FormField>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{errorMsg}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={!name.trim()}
          className="w-full text-white text-base font-black py-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
            boxShadow: `0 14px 32px -8px rgb(${theme.colors.primaryRgb} / 0.5)`,
          }}
        >
          登録する
        </button>
      </div>
    </main>
  )
}

function FormField({ label, required, children }: {
  label:     string
  required?: boolean
  children:  React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-500 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
