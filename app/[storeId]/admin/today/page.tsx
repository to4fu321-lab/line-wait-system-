'use client'

// ============================================================
// 「今日やること」スタッフ向けトップ画面（β / feature: today_tasks_ui）
//   案件種別を隠し、今すぐ/今日中/今週に分けて「次にやること」を提示。
// ============================================================
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, ClipboardList, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { resolveFeature } from '@/lib/features'
import { useSimpleMode } from '@/lib/useSimpleMode'
import { BottomNav } from '../_components/BottomNav'
import { InquiryModal, type InquiryRow } from '../_components/InquiryModal'
import { Toast } from '@/app/_components/Toast'
import { useTodayTasks } from './_lib/useTodayTasks'
import { BUCKET_META, type Bucket } from './_lib/task'
import { TodayTaskCard } from './_components/TodayTaskCard'

export default function TodayPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { hasFeature } = useStoreFeatures(storeId)
  const { isSimpleMode } = useSimpleMode(storeId)
  const { tasks, remaining, loading, refetch } = useTodayTasks(storeId)

  const [storeName, setStoreName] = useState('')
  const [allowed, setAllowed] = useState<boolean | null>(null) // フラグ判定（DB直読み）
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [inquiryItem, setInquiryItem] = useState<InquiryRow | null>(null)

  // 店舗名＋フラグを毎回DBから取得（sessionStorage古値での誤リダイレクトを防止）
  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    ;(supabase as any).from('stores').select('name, features').eq('id', storeId).single()
      .then(({ data }: { data: { name: string; features: Record<string, unknown> | null } | null }) => {
        if (cancelled) return
        setStoreName(data?.name ?? '')
        const features = data?.features ?? {}
        try { sessionStorage.setItem(`sf_${storeId}`, JSON.stringify(features)) } catch {}
        const ok = resolveFeature('today_tasks_ui', features)
        setAllowed(ok)
        if (!ok) router.replace(`/${storeId}/admin/repairs`)
      })
    return () => { cancelled = true }
  }, [storeId, router])

  const smsEnabled = hasFeature('sms_notify')
  const show = (type: 'ok' | 'err', msg: string) => setToast({ type, msg })

  if (allowed !== true) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
  }

  const buckets: Bucket[] = ['now', 'today', 'week']

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ヘッダ */}
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 pt-6 pb-5 sticky top-0 z-20">
        <p className="text-white/70 text-xs font-bold">{storeName}</p>
        <h1 className="text-2xl font-black mt-0.5">今日やること</h1>
        <p className="text-white/90 text-sm font-bold mt-1">
          {loading ? '読み込み中…' : remaining === 0 ? 'すべて完了しています 🎉' : <>残り <span className="text-3xl font-black">{remaining}</span> 件</>}
        </p>
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-5">
        {loading ? (
          <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-400" size={28} /></div>
        ) : remaining === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🎉</p>
            <p className="font-black text-gray-700">今日のやることは完了です</p>
            <p className="text-sm text-gray-400 mt-1">お疲れさまです。</p>
          </div>
        ) : (
          buckets.map(b => {
            const list = tasks.filter(t => t.bucket === b)
            if (list.length === 0) return null
            const meta = BUCKET_META[b]
            return (
              <section key={b} className="space-y-2.5">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-base">{meta.emoji}</span>
                  <h2 className={`font-black ${meta.accent}`}>{meta.label}</h2>
                  <span className="text-xs font-bold text-gray-400">{list.length}件</span>
                </div>
                {list.map(task => (
                  <TodayTaskCard
                    key={task.id} task={task} storeId={storeId} storeName={storeName}
                    smsEnabled={smsEnabled} onDone={refetch} onToast={show}
                    onOpenInquiry={(row) => setInquiryItem(row)}
                  />
                ))}
              </section>
            )
          })
        )}

        {/* すべての案件（一段深い管理画面へ） */}
        <button onClick={() => router.push(`/${storeId}/admin/repairs`)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-gray-500 rounded-2xl hover:bg-gray-100">
          <ClipboardList size={16} /> すべての案件を見る <ChevronRight size={16} />
        </button>
      </main>

      {inquiryItem && (
        <InquiryModal
          storeId={storeId} item={inquiryItem} isSimpleMode={isSimpleMode}
          onClose={() => setInquiryItem(null)}
          onSave={() => { setInquiryItem(null); refetch() }}
        />
      )}

      <BottomNav />
    </div>
  )
}
