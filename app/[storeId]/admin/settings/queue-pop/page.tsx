'use client'

import { useParams } from 'next/navigation'
import { PopEditor } from '../../_components/PopEditor'
import { FeatureGuard } from '@/app/_components/FeatureGuard'

// 順番待ちQR POP。順番待ちを使わない店では作れないようにする
// （入口を隠すだけだとURL直打ちで入れてしまう）
export default function QueuePopEditorPage() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  return (
    <FeatureGuard storeId={storeId} feature="tab_queue">
      <PopEditor kind="queue" />
    </FeatureGuard>
  )
}
