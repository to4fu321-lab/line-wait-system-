'use client'

import { ReactNode, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { DeviceModeProvider } from './_components/DeviceModeProvider'
import { SideNav } from './_components/SideNav'
import { OrderReminderBanner } from './_components/OrderReminderBanner'
import { FeedbackButton } from './_components/FeedbackButton'
import OfflineBanner from '@/app/_components/OfflineBanner'
import { useDeviceMode } from '@/lib/useDeviceMode'
import { useUiSettings } from '@/lib/useSimpleMode'

// 「大きい文字」設定: Tailwind のサイズは全て rem 基準のため、
// html の font-size を上げるだけで管理画面全体が拡大される。
// この layout は /[storeId]/admin 配下でのみマウントされるので、
// お客様向け画面（LIFF等）には影響しない。
function LargeTextEffect() {
  const { storeId } = useParams<{ storeId: string }>()
  const { settings } = useUiSettings(storeId)
  const largeText = settings.large_text === true

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.style.fontSize = largeText ? '18px' : ''
    return () => { document.documentElement.style.fontSize = '' }
  }, [largeText])

  return null
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { isTablet } = useDeviceMode()

  if (isTablet) {
    return (
      <div className="flex h-[100dvh] bg-gray-50">
        <OfflineBanner />
        <OrderReminderBanner />
        <SideNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
        <FeedbackButton />
      </div>
    )
  }

  // phone mode: pass through, BottomNav is rendered inside each page
  return (
    <>
      <OfflineBanner />
      <OrderReminderBanner />
      {children}
      <FeedbackButton />
    </>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DeviceModeProvider>
      <LargeTextEffect />
      <AdminLayoutInner>
        {children}
      </AdminLayoutInner>
    </DeviceModeProvider>
  )
}
