'use client'

import { ReactNode } from 'react'
import { DeviceModeProvider } from './_components/DeviceModeProvider'
import { SideNav } from './_components/SideNav'
import { useDeviceMode } from '@/lib/useDeviceMode'

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { isTablet } = useDeviceMode()

  if (isTablet) {
    return (
      <div className="flex h-[100dvh] bg-gray-50">
        <SideNav />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    )
  }

  // phone mode: pass through, BottomNav is rendered inside each page
  return <>{children}</>
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DeviceModeProvider>
      <AdminLayoutInner>
        {children}
      </AdminLayoutInner>
    </DeviceModeProvider>
  )
}
