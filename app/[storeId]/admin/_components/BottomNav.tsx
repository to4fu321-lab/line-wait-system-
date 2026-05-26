'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { Timer, Scissors, Search, Settings } from 'lucide-react'

const TABS = [
  {
    id:    'queue',
    label: '待ち状況',
    icon:  Timer,
    href:  (sid: string) => `/${sid}/admin`,
    exact: true,
  },
  {
    id:    'repairs',
    label: 'お直し・追加',
    icon:  Scissors,
    href:  (sid: string) => `/${sid}/admin/repairs`,
    exact: false,
  },
  {
    id:    'crm',
    label: '顧客検索',
    icon:  Search,
    href:  (sid: string) => `/${sid}/admin/crm`,
    exact: false,
  },
  {
    id:    'settings',
    label: '設定',
    icon:  Settings,
    href:  (sid: string) => `/${sid}/admin/settings`,
    exact: false,
  },
] as const

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params.storeId ?? ''

  function isActive(tab: typeof TABS[number]) {
    const target = tab.href(storeId)
    if (tab.exact) return pathname === target
    return pathname.startsWith(target)
  }

  return (
    <>
      {/* spacer so content isn't hidden under nav */}
      <div className="h-16" />

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 flex">
        {TABS.map(tab => {
          const active = isActive(tab)
          const Icon   = tab.icon
          return (
            <Link
              key={tab.id}
              href={tab.href(storeId)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative ${
                active ? 'text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-4 h-0.5 bg-indigo-500 rounded-full" />
              )}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
