'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  parseRepairSettings, DEFAULT_LABELS, PROFILE_DEFAULTS,
  type RepairSettings, type RepairLabels, type RepairProfileKey,
} from '@/lib/repairProfile'

// ── 店舗単位のお直し業種プロファイル（stores.repair_settings）────────
// useUiSettings と同じモジュール内ストア方式。同一ページで受付モーダルと
// 一覧が同時購読しても DB 取得は1回で、変更は全購読者へ即反映される。

const memCache     = new Map<string, RepairSettings>()
const fetchedStores = new Set<string>()
const listeners    = new Map<string, Set<() => void>>()

const cacheKey = (storeId: string) => `repair_settings_${storeId}`

function notify(storeId: string) {
  listeners.get(storeId)?.forEach(fn => fn())
}

function readSessionCache(storeId: string): RepairSettings | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(storeId))
    return raw ? (JSON.parse(raw) as RepairSettings) : null
  } catch { /* 壊れたキャッシュはDB再取得で回復 */ return null }
}

function setSettings(storeId: string, s: RepairSettings) {
  memCache.set(storeId, s)
  try { sessionStorage.setItem(cacheKey(storeId), JSON.stringify(s)) } catch { /* キャッシュ失敗は無視（DBが正） */ }
  notify(storeId)
}

async function fetchSettings(storeId: string) {
  fetchedStores.add(storeId)
  const { data, error } = await (supabase as any)
    .from('stores').select('repair_settings').eq('id', storeId).single()
  if (error) { fetchedStores.delete(storeId); return /* 再マウント時に再取得で回復 */ }
  setSettings(storeId, (data?.repair_settings ?? {}) as RepairSettings)
}

export interface UseRepairProfile {
  profile:  RepairProfileKey
  labels:   RepairLabels
  materialEnabled:     boolean
  intakePhotoRequired: boolean
  isLoaded: boolean
  save:     (patch: RepairSettings) => Promise<boolean>
}

export function useRepairProfile(storeId: string): UseRepairProfile {
  const [raw, setRaw]           = useState<RepairSettings>(() => memCache.get(storeId) ?? {})
  const [isLoaded, setIsLoaded] = useState(() => memCache.has(storeId))

  useEffect(() => {
    if (!storeId) return
    const onChange = () => { setRaw(memCache.get(storeId) ?? {}); setIsLoaded(true) }
    let subs = listeners.get(storeId)
    if (!subs) { subs = new Set(); listeners.set(storeId, subs) }
    subs.add(onChange)

    if (memCache.has(storeId)) {
      onChange()
    } else {
      const cached = readSessionCache(storeId)
      if (cached) setSettings(storeId, cached)
    }
    if (!fetchedStores.has(storeId)) fetchSettings(storeId)
    return () => { subs!.delete(onChange) }
  }, [storeId])

  // 楽観更新でDBへ保存。失敗時は元に戻して false を返す（呼び出し側でトースト表示）
  const save = useCallback(async (patch: RepairSettings): Promise<boolean> => {
    const prev = memCache.get(storeId) ?? {}
    const next = { ...prev, ...patch }
    setSettings(storeId, next)
    const { error } = await (supabase as any)
      .from('stores').update({ repair_settings: next }).eq('id', storeId)
    if (error) { setSettings(storeId, prev); return false }
    return true
  }, [storeId])

  const parsed = parseRepairSettings(raw)
  return {
    profile:  parsed.profile,
    // 未ロード時は制服既定で描画（ちらつき防止。ロード後に差し替わる）
    labels:   isLoaded ? parsed.labels : DEFAULT_LABELS,
    materialEnabled:     parsed.material_enabled,
    intakePhotoRequired: parsed.intake_photo_required,
    isLoaded,
    save,
  }
}

// プロファイル選択UI用（設定画面のセレクト）
export const PROFILE_CHOICES = (Object.keys(PROFILE_DEFAULTS) as RepairProfileKey[])
  .map(k => ({ value: k, label: PROFILE_DEFAULTS[k].label }))
