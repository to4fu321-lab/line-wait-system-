'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Timer, Scissors, Search, Settings, Plus, X, Package, ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const TABS = [
  { id: 'queue',    label: '受付',    icon: Timer,    exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'repairs',  label: '依頼管理', icon: ClipboardList, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'delivery', label: 'お渡し',  icon: Package,  exact: false, path: (sid: string) => `/${sid}/admin/delivery` },
  { id: 'crm',      label: '顧客',    icon: Search,   exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'settings', label: '設定',    icon: Settings, exact: false, path: (sid: string) => `/${sid}/admin/settings/staff` },
] as const

const FAB_ITEMS = [
  { label: '依頼受付（お直し・来店・取置き）', emoji: '📝', path: (sid: string) => `/${sid}/admin/crm` },
  { label: '制服注文を追加',                   emoji: '📋', path: (sid: string) => `/${sid}/admin/orders` },
  { label: '商品マスタ管理',                   emoji: '📦', path: (sid: string) => `/${sid}/admin/products` },
]

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const [repairBadge,   setRepairBadge]   = useState(0)
  const [deliveryBadge, setDeliveryBadge] = useState(0)
  const [fabOpen, setFabOpen] = useState(false)

  useEffect(() => {
    if (!storeId) return
    const fetchBadges = async () => {
      const [{ count: r }, { count: p }, { count: rc }, { count: pa }] = await Promise.all([
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['received', 'completed']),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['ordered', 'received', 'stocked', 'on_order', 'arrived']),
        // お渡し待ちバッジ: completed + arrived のみ
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'completed'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'arrived'),
      ])
      setRepairBadge((r ?? 0) + (p ?? 0))
      setDeliveryBadge((rc ?? 0) + (pa ?? 0))
    }
    fetchBadges()
    const t = setInterval(fetchBadges, 60000)
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

      {fabOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
      )}

      <div className="fixed bottom-20 right-3 z-50 flex flex-col items-end gap-2">
        {fabOpen && FAB_ITEMS.map(item => (
          <Link
            key={item.label}
            href={item.path(storeId)}
            onClick={() => setFabOpen(false)}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm font-medium text-gray-900 shadow-xl whitespace-nowrap"
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

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-sm">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(tab => {
            const active       = isActive(tab)
            const Icon         = tab.icon
            const repairBadgeN = tab.id === 'repairs'  ? repairBadge   : 0
            const delivBadgeN  = tab.id === 'delivery' ? deliveryBadge : 0
            const badgeCount   = repairBadgeN + delivBadgeN
            return (
              <Link
                key={tab.id}
                href={tab.path(storeId)}
                prefetch={false}
                style={{ touchAction: 'manipulation' }}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative transition-none ${
                  active ? 'text-indigo-600' : 'text-gray-400 active:text-gray-600'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <span className="relative inline-flex">
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-black px-1 rounded-full leading-tight min-w-[15px] text-center">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span className={`text-[9px] leading-none font-medium ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
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
