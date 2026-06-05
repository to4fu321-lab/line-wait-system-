'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Timer, Search, Settings, ClipboardList, Monitor } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { useDeviceMode } from '@/lib/useDeviceMode'

const ALL_TABS = [
  { id: 'queue',    featureKey: 'tab_queue',   label: '受付', icon: Timer,         exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'repairs',  featureKey: 'tab_repairs', label: '案件', icon: ClipboardList, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'crm',      featureKey: 'tab_crm',     label: '顧客', icon: Search,        exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'settings', featureKey: null,           label: '設定', icon: Settings,      exact: false, path: (sid: string) => `/${sid}/admin/settings/staff` },
] as const

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const [repairBadge, setRepairBadge] = useState(0)
  const { hasFeature } = useStoreFeatures(storeId)
  const { isTablet, setMode } = useDeviceMode()

  useEffect(() => {
    if (!storeId) return
    const fetchBadges = async () => {
      const [{ count: r }, { count: p }, { count: rc }, { count: pa }] = await Promise.all([
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'received'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).in('status', ['ordered', 'received', 'on_order']),
        (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'completed'),
        (supabase as any).from('purchase_orders').select('*', { count: 'exact', head: true })
          .eq('store_id', storeId).eq('status', 'arrived'),
      ])
      setRepairBadge((r ?? 0) + (p ?? 0) + (rc ?? 0) + (pa ?? 0))
    }
    fetchBadges()
    const t = setInterval(fetchBadges, 60000)
    return () => clearInterval(t)
  }, [storeId])

  // In tablet mode the SideNav handles navigation — hide BottomNav
  if (isTablet) return null

  const tabs = ALL_TABS.filter(t =>
    t.featureKey === null || hasFeature(t.featureKey as Parameters<typeof hasFeature>[0])
  )

  function isActive(tab: typeof ALL_TABS[number]) {
    const target = tab.path(storeId)
    if (tab.exact) return pathname === target || pathname === target + '/'
    return pathname.startsWith(target)
  }

  return (
    <>
      <div className="shrink-0" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }} />

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex max-w-lg mx-auto">
          {tabs.map(tab => {
            const active     = isActive(tab)
            const Icon       = tab.icon
            const badgeCount = tab.id === 'repairs' ? repairBadge : 0
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
          {/* Tablet mode toggle — long-press / tap the Monitor icon */}
          <button
            onClick={() => setMode('tablet')}
            style={{ touchAction: 'manipulation' }}
            className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 text-gray-300 active:text-gray-500 transition-none"
            title="タブレットモードに切替"
          >
            <Monitor size={16} strokeWidth={1.5} />
            <span className="text-[8px] leading-none font-medium">PCモード</span>
          </button>
        </div>
      </nav>
    </>
  )
}
