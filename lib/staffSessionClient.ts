'use client'

import { supabase } from '@/lib/supabase'

/**
 * スタッフ用 Supabase Auth セッションのクライアント側ユーティリティ。
 * PIN 照合 API(/api/admin/verify-pin, /api/staff/verify)が返す
 * セッションを適用すると、以後の DB 読み書き・Realtime は
 * authenticated ロール(自店舗スコープ RLS)で実行される。
 */

export interface StaffSessionTokens {
  access_token: string
  refresh_token: string
}

/** PIN照合APIが返したセッションを supabase-js に適用する */
export async function applyStaffSession(session: StaffSessionTokens): Promise<boolean> {
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) console.error('[staffSession] setSession failed:', error.message)
  return !error
}

/** 対象店舗の有効なスタッフセッションを持っているか */
export async function hasStaffSession(storeId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const meta = (data.session?.user?.app_metadata ?? {}) as Record<string, unknown>
  return !!data.session && meta.store_id === storeId
}

/** ログアウト(セッション破棄) */
export async function clearStaffSession(): Promise<void> {
  try { await supabase.auth.signOut() } catch { /* ignore */ }
}
