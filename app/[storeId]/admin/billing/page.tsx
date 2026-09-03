'use client'

// ============================================================================
//  契約プラン・ご利用状況（/admin/billing）
//
//  無料トライアルは「仕事管理・SMS連絡・LINE連絡・顧客管理」を人数/件数を
//  限定して使えるようにしている（lib/features.ts PLAN_LIMITS）。上限に達すると
//  各画面はブロックしてこのページへの導線を出すが、ブロックされて初めて気づく
//  のでは印象が悪いので、上限に近づいていることをここで先に見せる。
//
//  Stripeが未設定（env未設定）の環境では「アップグレードする」を押しても
//  501 not_configured が返るので、その場合だけ問い合わせ導線にフォールバック
//  する（本番は設定済みなのでボタンがそのままCheckoutへ飛ぶ）。
// ============================================================================

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CreditCard, Users, UserCircle, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PLAN_DEFS, getPlanLimits, resolvePlan } from '@/lib/features'

type SubStatus = 'none' | 'active' | 'trialing' | 'other'

type UsageRow = { label: string; icon: ReactNode; used: number; limit: number | null }

function currentPeriodJst(): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value ?? '0000'
  const m = parts.find(p => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

function UsageBar({ row }: { row: UsageRow }) {
  const unlimited = row.limit == null
  const pct = unlimited ? 0 : Math.min(100, Math.round((row.used / Math.max(row.limit!, 1)) * 100))
  const near = !unlimited && pct >= 80
  return (
    <div className="px-5 py-4 rounded-2xl bg-white border-2 border-gray-100 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
          {row.icon}
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-800">{row.label}</p>
          <p className={`text-sm ${near ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
            {unlimited ? `${row.used}（無制限）` : `${row.used} / ${row.limit}`}
          </p>
        </div>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${near ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function BillingPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<ReturnType<typeof resolvePlan>>('full')
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [subStatus, setSubStatus] = useState<SubStatus>('none')
  const [busy, setBusy] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<'success' | 'cancel' | null>(null)

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('checkout')
      if (v === 'success' || v === 'cancel') setCheckoutResult(v)
    } catch {}
  }, [])

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    ;(async () => {
      const [{ data: store }, { data: sub }] = await Promise.all([
        (supabase as any).from('stores').select('features').eq('id', storeId).maybeSingle(),
        (supabase as any).from('store_subscriptions').select('status').eq('store_id', storeId).maybeSingle(),
      ])
      const rawFeatures = store?.features ?? {}
      const resolvedPlan = resolvePlan(rawFeatures)
      const limits = getPlanLimits(rawFeatures)

      const [{ count: customersUsed }, { count: staffUsed }, { data: smsRow }] = await Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true })
          .eq('store_id', storeId).is('deleted_at', null),
        supabase.from('staff').select('id', { count: 'exact', head: true })
          .eq('store_id', storeId).neq('active', false),
        (supabase as any).from('usage_counters').select('count')
          .eq('store_id', storeId).eq('metric', 'sms_per_month').eq('period', currentPeriodJst())
          .maybeSingle(),
      ])

      if (cancelled) return
      setPlan(resolvedPlan)
      setSubStatus(sub?.status === 'active' ? 'active' : sub?.status === 'trialing' ? 'trialing' : sub ? 'other' : 'none')
      setUsage([
        { label: '顧客登録数', icon: <Users size={20} />, used: customersUsed ?? 0, limit: limits.customers_max ?? null },
        { label: 'スタッフ登録数', icon: <UserCircle size={20} />, used: staffUsed ?? 0, limit: limits.staff_max ?? null },
        { label: '今月のSMS・LINE通知', icon: <MessageCircle size={20} />, used: smsRow?.count ?? 0, limit: limits.sms_per_month ?? null },
      ])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [storeId])

  const planDef = PLAN_DEFS[plan]
  const hasAnyLimit = usage.some(u => u.limit != null)
  const isSubscribed = subStatus === 'active' || subStatus === 'trialing'

  async function goCheckout() {
    setBusy(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 501) { setNotConfigured(true); setBusy(false); return }
      if (!res.ok || !json.url) throw new Error(json.error ?? '不明なエラー')
      window.location.href = json.url
    } catch (e) {
      setBusy(false)
      alert(`アップグレードページを開けませんでした: ${String(e)}`)
    }
  }

  async function goPortal() {
    setBusy(true)
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 501) { setNotConfigured(true); setBusy(false); return }
      if (!res.ok || !json.url) throw new Error(json.error ?? '不明なエラー')
      window.location.href = json.url
    } catch (e) {
      setBusy(false)
      alert(`契約管理ページを開けませんでした: ${String(e)}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href={`/${storeId}/admin/settings`} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="font-black text-lg text-gray-800">契約プラン・ご利用状況</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <>
            {checkoutResult === 'success' && (
              <div className="px-4 py-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-sm font-bold">
                ご契約ありがとうございます。反映まで少しお時間がかかる場合があります。
              </div>
            )}
            {checkoutResult === 'cancel' && (
              <div className="px-4 py-3 rounded-xl bg-gray-100 border-2 border-gray-200 text-gray-600 text-sm">
                お手続きはキャンセルされました。
              </div>
            )}

            <div className={`px-5 py-5 rounded-2xl border-2 shadow-sm ${planDef.tailwind}`}>
              <p className="text-sm opacity-80">現在のプラン</p>
              <p className="text-2xl font-black mt-1">{planDef.emoji} {planDef.label}</p>
              <p className="text-sm mt-1 opacity-80">{planDef.desc}</p>
            </div>

            {hasAnyLimit && (
              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-500 px-1">今月のご利用状況</p>
                {usage.map(row => <UsageBar key={row.label} row={row} />)}
              </div>
            )}

            <div className="px-5 py-5 rounded-2xl bg-white border-2 border-indigo-200 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <CreditCard size={20} className="text-indigo-600" />
                </div>
                <p className="font-black text-lg text-indigo-700">
                  {isSubscribed ? 'ご契約中です' : '有料プランについて'}
                </p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {isSubscribed
                  ? 'お支払い方法の変更・解約は「ご契約を管理する」からいつでも行えます。'
                  : hasAnyLimit
                    ? '有料プランでは、上記の上限なくご利用いただけます。'
                    : '現在のプランについてのご相談・変更のご希望はお気軽にどうぞ。'}
              </p>

              {notConfigured && (
                <p className="mt-3 text-sm text-amber-600 font-bold">
                  現在オンライン決済の準備中です。下記のお問い合わせよりご連絡ください。
                </p>
              )}

              {isSubscribed ? (
                <button
                  onClick={goPortal}
                  disabled={busy}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : 'ご契約を管理する'}
                </button>
              ) : (
                !notConfigured && (
                  <button
                    onClick={goCheckout}
                    disabled={busy}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : '有料プランに切り替える'}
                  </button>
                )
              )}

              <a
                href="mailto:to4fu321@gmail.com?subject=%E6%9C%89%E6%96%99%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%81%AE%E7%9B%B8%E8%AB%87"
                className="mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold active:scale-[0.98] transition-all"
              >
                プランについて相談する
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
