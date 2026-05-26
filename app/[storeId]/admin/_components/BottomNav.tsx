'use client'

import { useParams, usePathname } from 'next/navigation'
import { Timer, Scissors, Search, Settings } from 'lucide-react'

const TABS = [
  { id: 'queue',    label: '待ち状況',    icon: Timer,    exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'repairs',  label: 'お直し・追加', icon: Scissors, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'crm',      label: '顧客検索',    icon: Search,   exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'settings', label: '設定',        icon: Settings, exact: false, path: (sid: string) => `/${sid}/admin/settings` },
] as const

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''

  function isActive(tab: typeof TABS[number]) {
    const target = tab.path(storeId)
    if (tab.exact) return pathname === target || pathname === target + '/'
    return pathname.startsWith(target)
  }

  return (
    <>
      <div className="h-16 shrink-0" />
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-zinc-900 border-t border-zinc-800">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(tab => {
            const active = isActive(tab)
            const Icon   = tab.icon
            return (
              <a
                key={tab.id}
                href={tab.path(storeId)}
                style={{ touchAction: 'manipulation' }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 relative transition-none ${
                  active ? 'text-indigo-400' : 'text-zinc-500 active:text-zinc-300'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-indigo-500 rounded-full" />
                )}
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[10px] leading-none font-medium ${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
                  {tab.label}
                </span>
              </a>
            )
          })}
        </div>
      </nav>
    </>
  )
}
