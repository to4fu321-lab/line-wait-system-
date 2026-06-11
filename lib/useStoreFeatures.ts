'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type FeatureKey, resolveFeature } from '@/lib/features'

const cacheKey = (id: string) => `sf_${id}`

function readCache(storeId: string): Record<string, unknown> | null {
  if (typeof window === 'undefined' || !storeId) return null
  try {
    const v = sessionStorage.getItem(cacheKey(storeId))
    return v ? (JSON.parse(v) as Record<string, unknown>) : null
  } catch { return null }
}

export function useStoreFeatures(storeId: string) {
  const [rawFeatures, setRawFeatures] = useState<Record<string, unknown> | null>(
    () => readCache(storeId)
  )

  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('features')
      .eq('id', storeId).single()
      .then(({ data }: { data: { features: Record<string, unknown> } | null }) => {
        const features = data?.features ?? {}
        try { sessionStorage.setItem(cacheKey(storeId), JSON.stringify(features)) } catch {}
        setRawFeatures(features)
      })
  }, [storeId])

  function hasFeature(key: FeatureKey): boolean {
    if (rawFeatures === null) return true // まだ未ロード = 表示しておく
    return resolveFeature(key, rawFeatures)
  }

  return { hasFeature, loaded: rawFeatures !== null }
}
