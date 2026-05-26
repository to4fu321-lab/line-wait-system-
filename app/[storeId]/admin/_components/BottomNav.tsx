'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Timer, Scissors, Search, Settings, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'queue',    label: '待ち状況',        icon: Timer,    exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'repairs',  label: 'お直し・注文管理', icon: Scissors, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'crm',      label: '顧客検索',         icon: Search,   exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'settings', label: '設定',             icon: Settings, exact: false, path: (sid: string) => `/${sid}/admin/settings` },
] as const

const FAB_ITEMS = [
  { label: 'お直し・追加注文受付', emoji: '✂️', path: (sid: string) => `/${sid}/admin/crm` },
  { label: '制服注文を追加',         emoji: '📋', path: (sid: string) => `/${sid}/admin/orders` },
]

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const [badge, setBadge] = useState(0)
  const [fabOpen, setFabOpen] = useState(false)

  useEffect(() => {
    if (!storeId) return
    const fetchBadge = async () => {
      const [{ count: r }, { count: p }] = await Promise.all([
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).neq('status', 'delivered'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).neq('status', 'delivered'),
      ])
      setBadge((r ?? 0) + (p ?? 0))
    }
    fetchBadge()
    const t = setInterval(fetchBadge, 60000)
    return () => clearInterval(t)
  }, [storeId])

  function isActive(tab: typeof TABS[number]) {
    const target = tab.path(storeId)
    if (tab.exact) return pathname === target || pathname === target + '/'
    return pathname.startsWith(target)
  }

  return (
    <>
      <div className="h-16 shrink-0" />

      {/* FAB backdrop */}
      {fabOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
      )}

      {/* FAB */}
      <div className="fixed bottom-20 right-3 z-50 flex flex-col items-end gap-2">
        {fabOpen && FAB_ITEMS.map(item => (
          <Link
            key={item.label}
            href={item.path(storeId)}
            onClick={() => setFabOpen(false)}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-100 shadow-xl whitespace-nowrap"
          >
            <span>{item.emoji}</span>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setFabOpen(v => !v)}
          style={{ touchAction: 'manipulation' }}
          className={`w-13 h-13 w-[52px] h-[52px] rounded-full shadow-xl flex items-center justify-center transition-all ${
            fabOpen ? 'bg-zinc-700' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          {fabOpen
            ? <X size={22} className="text-white" />
            : <Plus size={22} className="text-white" />
          }
        </button>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-zinc-900 border-t border-zinc-800">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(tab => {
            const active    = isActive(tab)
            const Icon      = tab.icon
            const showBadge = tab.id === 'repairs' && badge > 0
            return (
              <Link
                key={tab.id}
                href={tab.path(storeId)}
                prefetch={false}
                style={{ touchAction: 'manipulation' }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 relative transition-none ${
                  active ? 'text-indigo-400' : 'text-zinc-500 active:text-zinc-300'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-indigo-500 rounded-full" />
                )}
                <span className="relative inline-flex">
                  <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                  {showBadge && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-black px-1 rounded-full leading-tight min-w-[15px] text-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none font-medium ${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
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
