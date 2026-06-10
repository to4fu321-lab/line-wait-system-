'use client'

// himonoya ブランチ — お直し専用のシンプルなBottomNav

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Scissors, Settings } from 'lucide-react'
import { useDeviceMode } from '@/lib/useDeviceMode'

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const { isTablet } = useDeviceMode()

  if (isTablet) return null

  const tabs = [
    { id: 'repairs',  label: 'お直し', icon: Scissors, path: `/${storeId}/admin/repairs` },
    { id: 'settings', label: '設定',   icon: Settings, path: `/${storeId}/admin/settings/staff` },
  ]

  return (
    <>
      <div className="shrink-0" style={{ height: 'calc(5rem + env(safe-area-inset-bottom))' }} />
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex max-w-lg mx-auto h-20">
          {tabs.map(tab => {
            const active = pathname.startsWith(tab.path)
            const Icon   = tab.icon
            return (
              <Link key={tab.id} href={tab.path} prefetch={false}
                style={{ touchAction: 'manipulation' }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-none ${
                  active ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                {active && <span className="absolute top-0 left-4 right-4 h-0.5 bg-indigo-600 rounded-full" />}
                <Icon size={24} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[11px] leading-none font-medium ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
