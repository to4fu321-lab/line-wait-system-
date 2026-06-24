'use client'

import { Store, ChevronRight, LayoutDashboard } from 'lucide-react'

interface StoreInfo { id: string; name: string; pin: string; group_id?: string | null; business_type?: string; features?: Record<string, unknown> | null }

// ============================================================
// 店舗選択画面
// ============================================================
export function StoreSelectScreen({ stores, groupCode, onSelect }: { stores: StoreInfo[]; groupCode: string | null; onSelect: (s: StoreInfo) => void }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="relative text-center mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🏪</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">管理画面</h1>
        <p className="text-gray-500 mt-2 text-sm">店舗を選択してください</p>
      </div>
      <div className="relative w-full max-w-sm space-y-3 animate-fade-in">
        {stores.map(store => (
          <button key={store.id} onClick={() => onSelect(store)}
            className="w-full flex items-center gap-4 bg-white hover:bg-gray-50 border border-gray-200 hover:border-indigo-400 active:scale-95 transition-all duration-150 rounded-2xl px-5 py-4 text-left group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
              <Store size={18} className="text-indigo-600" />
            </div>
            <span className="text-gray-900 text-lg font-bold flex-1">{store.name}</span>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
          </button>
        ))}
        {groupCode && (
          <div className="pt-4 border-t border-gray-200 space-y-1">
            <a href={`/company/${groupCode}`} className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 transition-colors py-2 px-1 text-sm font-bold">
              <LayoutDashboard size={15} /><span>会社管理ダッシュボード</span>
              <ChevronRight size={13} className="ml-auto" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export type { StoreInfo }
