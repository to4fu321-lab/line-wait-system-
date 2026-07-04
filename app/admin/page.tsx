'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { StoreSelectScreen } from '@/app/[storeId]/admin/_components/StoreSelectScreen'
import type { StoreInfo } from '@/app/[storeId]/admin/_components/StoreSelectScreen'

// ============================================================
// スタッフ画面 直接入口
// LINE/LIFF を経由せずに店舗スタッフ画面へ入るための入口。
// 店舗一覧から選択 → /{storeId}/admin（PIN → ダッシュボード）へ遷移する。
// 業種（business_type）による自動振り分けは行わず、常に統一の
// 管理画面へ入る。
// ============================================================
export default function StaffEntryPage() {
  const router = useRouter()
  const [stores, setStores] = useState<StoreInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/stores')
      .then(res => res.json())
      .then(({ stores: data, error }: { stores?: StoreInfo[]; error?: string }) => {
        if (error || !data || data.length === 0) {
          setError(error ?? '店舗データが見つかりません')
        } else {
          setStores(data)
        }
        setLoading(false)
      })
      .catch(err => { setError(String(err)); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-4 right-4 bg-red-600 text-white text-sm px-4 py-3 rounded-xl z-50 border border-red-700">
          エラー: {error}
        </div>
      )}
      <StoreSelectScreen
        stores={stores}
        groupCode={null}
        onSelect={s => router.push(`/${s.id}/admin`)}
      />
    </>
  )
}
