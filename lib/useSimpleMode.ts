'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── 店舗単位の画面設定（stores.ui_settings）──────────────────────
// 旧実装は localStorage 保存（端末ごと）だったが、どの端末でも同じ画面に
// なるよう DB 保存へ移行。旧 localStorage 値は DB 未設定店舗のフォール
// バックとしてのみ参照する。
// 形式: { simple_mode?: boolean, large_text?: boolean }

export interface UiSettings {
  simple_mode?: boolean
  large_text?: boolean
}

// モジュール内ストア: 同一ページで複数コンポーネントが同時購読しても
// 1回のDB取得を共有し、トグル操作が即座に全購読者へ反映される
const memCache = new Map<string, UiSettings>()
const fetchedStores = new Set<string>()
const listeners = new Map<string, Set<() => void>>()

const cacheKey  = (storeId: string) => `ui_settings_${storeId}`
const legacyKey = (storeId: string) => `simple-mode-${storeId}`

function notify(storeId: string) {
  listeners.get(storeId)?.forEach(fn => fn())
}

function readSessionCache(storeId: string): UiSettings | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(storeId))
    return raw ? (JSON.parse(raw) as UiSettings) : null
  } catch { /* 壊れたキャッシュはDB再取得で回復 */ return null }
}

function setSettings(storeId: string, s: UiSettings) {
  memCache.set(storeId, s)
  try { sessionStorage.setItem(cacheKey(storeId), JSON.stringify(s)) } catch { /* キャッシュ失敗は無視（DBが正） */ }
  notify(storeId)
}

// 旧 localStorage 値のフォールバック（DB に simple_mode 未設定の店舗のみ）
function withLegacyFallback(storeId: string, s: UiSettings): UiSettings {
  if (s.simple_mode === undefined && typeof window !== 'undefined' &&
      localStorage.getItem(legacyKey(storeId)) === 'true') {
    return { ...s, simple_mode: true }
  }
  return s
}

async function fetchSettings(storeId: string) {
  fetchedStores.add(storeId)
  const { data, error } = await (supabase as any)
    .from('stores').select('ui_settings').eq('id', storeId).single()
  if (error) { fetchedStores.delete(storeId); return /* 再マウント時に再取得で回復 */ }
  setSettings(storeId, withLegacyFallback(storeId, (data?.ui_settings ?? {}) as UiSettings))
}

export function useUiSettings(storeId: string) {
  const [settings, setLocal] = useState<UiSettings>(() => memCache.get(storeId) ?? {})
  const [isLoaded, setIsLoaded] = useState(() => memCache.has(storeId))

  useEffect(() => {
    if (!storeId) return
    const onChange = () => { setLocal(memCache.get(storeId) ?? {}); setIsLoaded(true) }
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
  const save = useCallback(async (patch: UiSettings): Promise<boolean> => {
    const prev = memCache.get(storeId) ?? {}
    const next = { ...prev, ...patch }
    setSettings(storeId, next)
    const { error } = await (supabase as any)
      .from('stores').update({ ui_settings: next }).eq('id', storeId)
    if (error) { setSettings(storeId, prev); return false }
    return true
  }, [storeId])

  return { settings, isLoaded, save }
}

// 互換API: 既存画面（repairs / today / inquiries）は従来どおり使える
export function useSimpleMode(storeId: string) {
  const { settings, isLoaded, save } = useUiSettings(storeId)
  const isSimpleMode = settings.simple_mode === true
  const toggle = useCallback(() => {
    save({ simple_mode: !(memCache.get(storeId)?.simple_mode === true) })
  }, [save, storeId])
  return { isSimpleMode, isLoaded, toggle }
}
