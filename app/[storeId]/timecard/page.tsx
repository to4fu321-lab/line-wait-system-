'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { TimecardKiosk } from './_components/TimecardKiosk'

const sb = supabase as any

export default function TimecardPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  const [storeName, setStoreName] = useState('')
  const [requirePin, setRequirePin] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!storeId) return
    sb.from('stores').select('name, timecard_settings').eq('id', storeId).single()
      .then(({ data }: any) => {
        setStoreName(data?.name ?? '店舗')
        setRequirePin(!!data?.timecard_settings?.require_pin)
        setReady(true)
      })
  }, [storeId])

  if (!loaded || !ready) return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  if (!hasFeature('shift_attendance')) {
    return <div className="min-h-[100dvh] grid place-items-center px-6 text-center text-gray-400">
      <p>この店舗ではタイムカードが有効になっていません。<br />店長にお問い合わせください。</p>
    </div>
  }

  return <TimecardKiosk storeId={storeId} storeName={storeName} requirePin={requirePin} />
}
