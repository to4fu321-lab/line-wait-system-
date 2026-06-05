'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Timer, Search, Settings, ClipboardList, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { useDeviceMode } from '@/lib/useDeviceMode'

const ALL_TABS = [
  { id: 'queue',    featureKey: 'tab_queue',   label: '受付管理', icon: Timer,         exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'repairs',  featureKey: 'tab_repairs', label: '案件管理', icon: ClipboardList, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'crm',      featureKey: 'tab_crm',     label: '顧客管理', icon: Search,        exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'settings', featureKey: null,           label: '設定',     icon: Settings,      exact: false, path: (sid: string) => `/${sid}/admin/settings/staff` },
] as const

export function SideNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const [repairBadge, setRepairBadge] = useState(0)
  const [storeName, setStoreName] = useState<string>('')
  const { hasFeature } = useStoreFeatures(storeId)
  const { setMode } = useDeviceMode()

  useEffect(() => {
    if (!storeId) return
    const fetchData = async () => {
      const [{ count: r }, { count: p }, { count: rc }, { count: pa }, storeRes] = await Promise.all([
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'received'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['ordered', 'received', 'on_order']),
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'completed'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'arrived'),
        (supabase as any).from('stores').select('name').eq('id', storeId).single(),
      ])
      setRepairBadge((r ?? 0) + (p ?? 0) + (rc ?? 0) + (pa ?? 0))
      if (storeRes.data?.name) setStoreName(storeRes.data.name)
    }
    fetchData()
    const t = setInterval(fetchData, 60000)
    return () => clearInterval(t)
  }, [storeId])

  const tabs = ALL_TABS.filter(t =>
    t.featureKey === null || hasFeature(t.featureKey as Parameters<typeof hasFeature>[0])
  )

  function isActive(tab: typeof ALL_TABS[number]) {
    const target = tab.path(storeId)
    if (tab.exact) return pathname === target || pathname === target + '/'
    return pathname.startsWith(target)
  }

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full sticky top-0 overflow-y-auto">
      {/* Store header */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center mb-2">
          <span className="text-xl">🏪</span>
        </div>
        <p className="text-xs text-gray-400 leading-none mb-0.5">管理画面</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{storeName || '店舗'}</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {tabs.map(tab => {
          const active     = isActive(tab)
          const Icon       = tab.icon
          const badgeCount = tab.id === 'repairs' ? repairBadge : 0
          return (
            <Link
              key={tab.id}
              href={tab.path(storeId)}
              prefetch={false}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="flex-1">{tab.label}</span>
              {badgeCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Mode toggle */}
      <div className="px-2 py-3 border-t border-gray-100">
        <button
          onClick={() => setMode('phone')}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Smartphone size={14} />
          スマホモードに切替
        </button>
      </div>
    </aside>
  )
}
