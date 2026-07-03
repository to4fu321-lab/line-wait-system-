'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface ConnectionStatus {
  /** ブラウザがネットワークに接続しているか（navigator.onLine ベース） */
  isOnline: boolean
  /** Supabase Realtime のチャンネルが接続済みか */
  isRealtimeConnected: boolean
}

/**
 * ネットワーク接続状態と Supabase Realtime の接続状態を監視するフック。
 * - `navigator.onLine` と window の online/offline イベントでオンライン判定
 * - `supabase.getChannels()` の各チャンネルの state を定期チェックで Realtime 判定
 *
 * 繁忙期の一時的な Wi-Fi 切断（数分）に耐えるための表示制御に利用する。
 */
export function useConnectionStatus(): ConnectionStatus {
  // SSR / 初回描画ではオンライン扱いにしてバナーのちらつきを防ぐ
  const [isOnline, setIsOnline] = useState(true)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true)

  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Realtime チャンネルの接続状態を定期チェック
    const checkRealtime = () => {
      const channels = supabase.getChannels()
      if (channels.length === 0) {
        // 購読チャンネルが無い場合はネットワーク状態に追従
        setIsRealtimeConnected(typeof navigator !== 'undefined' ? navigator.onLine : true)
        return
      }
      // いずれかのチャンネルが joined なら接続済みとみなす
      const anyJoined = channels.some(ch => String(ch.state) === 'joined')
      setIsRealtimeConnected(anyJoined)
    }
    checkRealtime()
    const intervalId = setInterval(checkRealtime, 5000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [])

  return { isOnline, isRealtimeConnected }
}
