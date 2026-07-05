'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, MessageCircle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff, getLineProfile, openAddFriend } from '@/lib/liff'
import { fetchCustomerSession, saveCustomer } from '@/lib/customerApi'
import { resolveFeature } from '@/lib/features'
import { useStoreTheme } from '@/lib/theme-context'
import { InitialRegistrationForm, SimpleRegistrationForm } from '@/app/_components/RegistrationForms'

type View = 'loading' | 'add_friend' | 'new_form' | 'done' | 'not_line'

const LINE_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BASIC_ID || 'cyx2612b'

export default function CrmRegisterPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()
  const theme       = useStoreTheme()

  const [view,            setView]            = useState<View>('loading')
  const [lineUserId,      setLineUserId]      = useState('')
  const [lineDisplayName, setLineDisplayName] = useState('')
  // 店舗マスタ（順番待ちの会員登録と同じフォームで使う）
  const [isSimpleMode,       setIsSimpleMode]       = useState(false)
  const [schools,            setSchools]            = useState<{ id: string; name: string }[]>([])
  const [storeSchoolOptions, setStoreSchoolOptions] = useState<string[]>([])

  const [saving,   setSaving]   = useState(false)
  const [doneName, setDoneName] = useState('')
  const [checking, setChecking] = useState(false)
  const [friendFailed, setFriendFailed] = useState(false)

  const cardStyle: React.CSSProperties = {
    boxShadow: `0 24px 60px -20px rgb(${theme.colors.primaryRgb} / 0.22), 0 1px 0 0 rgb(255 255 255 / 0.65) inset`,
  }

  // 既存顧客なら本体ページ（メニュー）へ委譲する。crm-register は
  // 「新規QRからの会員登録」専用に絞る。
  const routeAfterIdentity = async () => {
    const { customer } = await fetchCustomerSession(storeId)
    if (customer) { router.replace(`/${storeId}`); return }
    setView('new_form')
  }

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      const { data: sd } = await (supabase as any).from('stores')
        .select('features, school_names').eq('id', storeId).single()
      const features = (sd?.features ?? {}) as Record<string, unknown>
      // 順番待ち機能が無い店舗はシンプル登録（名前+電話）
      setIsSimpleMode(!resolveFeature('tab_queue', features))
      if (Array.isArray(sd?.school_names) && sd.school_names.length > 0) setStoreSchoolOptions(sd.school_names)

      // 学校マスタ（ドロップダウン用）
      const { data: schoolRows } = await (supabase as any).from('schools')
        .select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      if (schoolRows && schoolRows.length > 0) {
        setSchools(schoolRows as { id: string; name: string }[])
        setStoreSchoolOptions(schoolRows.map((s: { name: string }) => s.name))
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
        setLineDisplayName(profile.displayName ?? '')

        const res = await fetch(`/api/check-friend?userId=${profile.userId}`)
        const { friend } = await res.json()
        if (!friend) { setView('add_friend'); return }

        await routeAfterIdentity()
      } catch {
        setView('not_line')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId])

  const handleProceedAfterFriend = async () => {
    if (!lineUserId) return
    setChecking(true); setFriendFailed(false)
    try {
      const res = await fetch(`/api/check-friend?userId=${lineUserId}`)
      const { friend } = await res.json()
      if (friend) {
        await routeAfterIdentity()
      } else {
        setFriendFailed(true)
      }
    } catch { setFriendFailed(true) }
    setChecking(false)
  }

  // 店側端末へ「新規会員登録」を通知（受付番号は発行しない）
  const notifyRegistered = (displayName: string, extra?: string) => {
    fetch('/api/push-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId,
        type:  'customer_register',
        title: `📱 新規会員登録：${displayName} 様`,
        body:  `${extra ? `${extra} · ` : ''}お客様が会員登録を完了しました`,
        url:   `/${storeId}/admin/crm`,
      }),
    }).catch(() => {})
  }

  // ── 初回登録（保護者 + お子様）──────────────────────
  const handleInitialRegister = async (d: {
    parentName: string; parentKana: string; tel: string
    childName: string; childKana: string; schoolName: string; schoolId: string; grade: string
    heightCm: string; weightKg: string; gender: string
  }) => {
    let userId = lineUserId
    if (!userId) {
      const fresh = await getLineProfile()
      if (fresh) { setLineUserId(fresh.userId); userId = fresh.userId }
    }
    if (!userId || saving) return
    setSaving(true)
    try {
      await saveCustomer(storeId, {
        customer: { name: d.parentName, kana: d.parentKana || null, tel: d.tel || null },
        childInsert: {
          name: d.childName, kana: d.childKana || null,
          school_id: d.schoolId || null, school_name: d.schoolName || null,
          grade: d.grade || null, gender: d.gender || null,
        },
      })

      notifyRegistered(d.parentName, d.schoolName || undefined)
      setDoneName(d.childName || d.parentName)
      setSaving(false)
      setView('done')
    } catch {
      setSaving(false)
    }
  }

  // ── シンプル登録（名前 + 電話）──────────────────────
  const handleSimpleRegister = async (d: { name: string; tel: string }) => {
    let userId = lineUserId
    if (!userId) {
      const fresh = await getLineProfile()
      if (fresh) { setLineUserId(fresh.userId); userId = fresh.userId }
    }
    if (!userId || saving) return
    setSaving(true)
    try {
      await saveCustomer(storeId, {
        customer: { name: d.name, tel: d.tel || null },
      })
      notifyRegistered(d.name)
      setDoneName(d.name)
      setSaving(false)
      setView('done')
    } catch {
      setSaving(false)
    }
  }

  // ── ローディング ──────────────────────────────
  if (view === 'loading') return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderTopColor: theme.colors.primary }} />
        <p className="text-sm text-zinc-500">読み込み中…</p>
      </div>
    </div>
  )

  // ── 友達追加が必要 ────────────────────────────
  if (view === 'add_friend') return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10 gap-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 16px 40px -12px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          <MessageCircle size={32} className="text-white" />
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black mb-3 text-zinc-900">友だち追加のお願い</h1>
        <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">
          お呼び出しや完了通知をLINEで確実に受け取るために友だち追加をお願いします
        </p>
      </div>
      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl p-6 w-full max-w-sm border border-white/60 space-y-3" style={cardStyle}>
        <button onClick={() => openAddFriend(LINE_BASIC_ID)}
          className="w-full bg-[#06C755] text-white text-base font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-green-200">
          <MessageCircle size={20} />LINEで友だち追加する
        </button>
        <button onClick={handleProceedAfterFriend} disabled={checking}
          className="w-full py-3.5 rounded-2xl border-2 border-zinc-200 text-zinc-600 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
          {checking
            ? <><Loader2 size={14} className="animate-spin" />確認中...</>
            : '追加しました → 登録へ進む'}
        </button>
        {friendFailed && (
          <p className="text-amber-600 text-xs text-center">
            友達追加が確認できません。追加してから再度お試しください。
          </p>
        )}
      </div>
    </main>
  )

  // ── LINE未使用 ────────────────────────────────
  if (view === 'not_line') return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center gap-4">
      <MessageCircle size={64} style={{ color: theme.colors.primary }} className="opacity-80" />
      <div>
        <h1 className="text-2xl font-black mb-2 text-zinc-900">LINEで開いてください</h1>
        <p className="text-zinc-500 text-base">スタッフのQRコードをLINEカメラで<br />読み取ってください</p>
      </div>
    </main>
  )

  // ── 会員登録完了 ──────────────────────────────
  if (view === 'done') return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 max-w-md mx-auto text-center">
      <div className="w-20 h-20 mx-auto mb-5 rounded-3xl flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 16px 40px -10px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
        <CheckCircle2 size={40} className="text-white" />
      </div>
      <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
      <h1 className="text-3xl font-black text-zinc-900 mb-1">会員登録完了！</h1>
      {doneName && <p className="text-lg font-bold text-zinc-600 mb-2">{doneName} 様</p>}
      <p className="text-zinc-500 text-sm leading-relaxed">
        続けてメニューをお選びいただくか、<br />スタッフにお声がけください。
      </p>

      <div className="mt-8 w-full space-y-3">
        <button onClick={() => router.push(`/${storeId}`)}
          className="w-full text-white text-base font-black py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
            boxShadow:  `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
          }}>
          メニューを選ぶ<ChevronRight size={18} />
        </button>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 px-5 py-4 text-zinc-600 text-sm leading-relaxed" style={cardStyle}>
          <p className="font-bold text-zinc-800">お急ぎの方はスタッフへ</p>
          <p className="mt-0.5 text-zinc-500">この画面をお見せいただければ受付できます</p>
        </div>
      </div>
    </main>
  )

  // ── 新規登録フォーム（順番待ちと同じフォーム）──────
  return (
    <main className="min-h-[100dvh] px-5 py-10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})`, boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.5)` }}>
          {theme.logoEmoji}
        </div>
        <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>{theme.storeName}</p>
        <h1 className="text-2xl font-black text-zinc-900">お客様情報の登録</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {lineDisplayName ? `${lineDisplayName} さんのLINEで登録します` : '初回のみご入力ください。次回は自動で認識します'}
        </p>
      </div>
      <div className="bg-white/75 backdrop-blur-2xl rounded-3xl border border-white/60 p-5" style={cardStyle}>
        {isSimpleMode ? (
          <SimpleRegistrationForm
            lineDisplayName={lineDisplayName}
            onSubmit={handleSimpleRegister}
            submitting={saving}
          />
        ) : (
          <InitialRegistrationForm
            lineDisplayName={lineDisplayName}
            onSubmit={handleInitialRegister}
            submitting={saving}
            schoolOptions={storeSchoolOptions}
            schools={schools}
          />
        )}
      </div>
    </main>
  )
}
