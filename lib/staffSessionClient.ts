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

/**
 * Supabase の書き込みエラーが RLS(セッション切れ)によるものかを判定する。
 * 管理画面の各ページは admin トップ('/[storeId]/admin')でPIN認証時に
 * スタッフセッションを張るが、そのページを経由せず直接サブページへ
 * 来た場合や、セッション期限切れの場合に customers 等への書き込みで
 * 「new row violates row-level security policy」が発生しうる。
 */
export function isSessionExpiredError(error: { message?: string } | null | undefined): boolean {
  return !!error?.message?.includes('row-level security')
}
