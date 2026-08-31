'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Timer, Search, Settings, ClipboardList, ShoppingCart } from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { useDeviceMode } from '@/lib/useDeviceMode'
import { useWorkBadge } from '@/lib/workBadge'


const ALL_TABS = [
  { id: 'repairs',  featureKey: 'tab_repairs', label: 'お仕事',     icon: ClipboardList, exact: false, path: (sid: string) => `/${sid}/admin/repairs` },
  { id: 'queue',    featureKey: 'tab_queue',   label: '順番待•予約', icon: Timer,         exact: true,  path: (sid: string) => `/${sid}/admin` },
  { id: 'crm',      featureKey: 'tab_crm',     label: '顧客',  icon: Search,        exact: false, path: (sid: string) => `/${sid}/admin/crm` },
  { id: 'pos',      featureKey: 'pos',         label: 'レジ',  icon: ShoppingCart,  exact: false, path: (sid: string) => `/${sid}/admin/register` },
  { id: 'settings', featureKey: null,           label: '設定',  icon: Settings,      exact: false, path: (sid: string) => `/${sid}/admin/settings/staff` },
] as const

export function BottomNav() {
  const params   = useParams<{ storeId: string }>()
  const pathname = usePathname()
  const storeId  = params?.storeId ?? ''
  const [queueBadge,  setQueueBadge]  = useState(0)
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)
  const { isTablet } = useDeviceMode()
  // 集計は lib/workBadge.ts に集約（お仕事ページのタイルと定義を揃えるため）
  const repairBadge = useWorkBadge(storeId, hasFeature, featLoaded)

  useEffect(() => {
    if (!storeId) return
    const fetchBadges = async () => {
      const { count: waiting } = await (supabase as any).from('queues')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).eq('status', 'waiting').gte('created_at', getTodayStart())
      setQueueBadge(waiting ?? 0)
    }
    fetchBadges()
    const t = setInterval(fetchBadges, 60000)
    return () => clearInterval(t)
  }, [storeId])

  // Hide until features loaded to prevent wrong-tab flash; tablet uses SideNav
  if (!featLoaded || isTablet) return null

  const tabs = ALL_TABS.filter(t =>
    t.featureKey === null || hasFeature(t.featureKey as Parameters<typeof hasFeature>[0])
  )

  // today_tasks_ui ON のとき、案件タブを「やること」(/admin/today)へ差し替え
  const todayOn = hasFeature('today_tasks_ui')
  const tabPath = (tab: typeof ALL_TABS[number]) =>
    todayOn && tab.id === 'repairs' ? `/${storeId}/admin/today` : tab.path(storeId)
  const tabLabel = (tab: typeof ALL_TABS[number]) =>
    todayOn && tab.id === 'repairs' ? 'やること' : tab.label

  function isActive(tab: typeof ALL_TABS[number]) {
    const target = tabPath(tab)
    if (tab.exact) return pathname === target || pathname === target + '/'
    return pathname.startsWith(target)
  }

  function badgeFor(tab: typeof ALL_TABS[number]) {
    if (tab.id === 'queue')   return queueBadge
    if (tab.id === 'repairs') return repairBadge
    return 0
  }

  return (
    <>
      <div className="shrink-0" style={{ height: 'calc(5rem + env(safe-area-inset-bottom))' }} />

      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex max-w-lg mx-auto h-20">
          {tabs.map(tab => {
            const active     = isActive(tab)
            const Icon       = tab.icon
            const badgeCount = badgeFor(tab)
            return (
              <Link
                key={tab.id}
                href={tabPath(tab)}
                prefetch={false}
                style={{ touchAction: 'manipulation' }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-none ${
                  active ? 'text-indigo-600' : 'text-gray-400 active:text-gray-600'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <span className="relative inline-flex">
                  <Icon size={24} strokeWidth={active ? 2.5 : 1.8} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-2 -right-3 inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full leading-none">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none font-medium ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {tabLabel(tab)}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
