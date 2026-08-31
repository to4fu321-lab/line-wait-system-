'use client'

// ============================================================================
//  プランで使えないページを直接開いたときの表示
//
//  入口（設定のリンクやタブ）を hasFeature で隠すだけだと、ブックマークや
//  URL直打ちで中身に入れてしまう。実際「順番待ちタブOFFの店で順番待ちQR POPが
//  作れる」状態になっていた。入口とページの両方で同じキーを見るようにする。
// ============================================================================

import { useRouter } from 'next/navigation'
import type { FeatureKey } from '@/lib/features'
import { useStoreFeatures } from '@/lib/useStoreFeatures'

export function FeatureLocked() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-lg font-black text-gray-800 mb-2">このページは現在のプランでは利用できません</h1>
      <p className="text-sm text-gray-400 mb-6">スーパー管理画面でプランを変更するか、管理者にお問い合わせください</p>
      <button onClick={() => router.back()}
        className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl">戻る</button>
    </div>
  )
}

/**
 * ページ全体を機能フラグで囲う。
 * 判定が済むまでは children を出す（読み込み中に一瞬ロック画面が出るのを防ぐ）。
 */
export function FeatureGuard({ storeId, feature, children }: {
  storeId:  string
  feature:  FeatureKey
  children: React.ReactNode
}) {
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  if (loaded && !hasFeature(feature)) return <FeatureLocked />
  return <>{children}</>
}
