'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type FeatureKey, resolveFeature } from '@/lib/features'

export function useStoreFeatures(storeId: string) {
  const [rawFeatures, setRawFeatures] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('features')
      .eq('id', storeId).single()
      .then(({ data }: { data: { features: Record<string, unknown> } | null }) => {
        setRawFeatures(data?.features ?? {})
      })
  }, [storeId])

  function hasFeature(key: FeatureKey): boolean {
    if (rawFeatures === null) return true // まだ未ロード = 表示しておく
    return resolveFeature(key, rawFeatures)
  }

  return { hasFeature, loaded: rawFeatures !== null }
}
