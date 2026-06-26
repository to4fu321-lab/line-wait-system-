'use client'

// ============================================================
// 最近登録されたお客様（15分以内）サジェスト — 共通コンポーネント
//   顧客名検索を行うすべての画面で使い回す。
//   検索欄が空のとき、直近に登録された顧客を候補として表示し、
//   QR/LINEで登録したばかりのお客様をワンタップで選べるようにする。
// ============================================================
import { useEffect, useState } from 'react'
import { Clock, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export interface RecentCust {
  id: string
  name: string
  tel: string | null
  school_name?: string | null
  line_user_id?: string | null
  created_at?: string | null
  children?: { id: string; name: string; school_name: string | null }[]
}

type RecentChild = { id: string; name: string; school_name: string | null }

// 新規登録とみなす猶予（直近登録の候補表示に使用）
const RECENT_WINDOW_MS = 15 * 60 * 1000

/** 直近 15 分以内に登録された顧客を取得するフック */
export function useRecentCustomers(storeId: string, enabled = true): RecentCust[] {
  const [recent, setRecent] = useState<RecentCust[]>([])
  useEffect(() => {
    if (!enabled || !storeId) { setRecent([]); return }
    let active = true
    const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString()
    ;(supabase as any).from('customers')
      .select('id, name, tel, school_name, line_user_id, created_at, children:children(id, name, school_name)')
      .eq('store_id', storeId).is('deleted_at', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false }).limit(6)
      .then(({ data }: { data: RecentCust[] | null }) => { if (active) setRecent(data ?? []) })
    return () => { active = false }
  }, [storeId, enabled])
  return recent
}

/**
 * 「最近登録されたお客様（15分以内）」の候補リスト。
 * visible=false のとき、または該当が無いときは何も描画しない。
 *
 * - withChildren: お子様がいる顧客は、お子様ごとの行に展開して表示する
 *   （お直し・注文など、お子様単位で紐付けたい画面向け）
 */
export function RecentCustomers({
  storeId,
  visible = true,
  withChildren = false,
  onPick,
}: {
  storeId: string
  visible?: boolean
  withChildren?: boolean
  onPick: (c: RecentCust, child: RecentChild | null) => void
}) {
  const recent = useRecentCustomers(storeId, visible)
  if (!visible || recent.length === 0) return null

  const Row = ({ c, child }: { c: RecentCust; child: RecentChild | null }) => (
    <button
      onClick={() => onPick(c, child)}
      className="w-full flex items-center gap-3 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-b border-emerald-100 last:border-0 text-left transition-colors">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-emerald-700">{(child?.name ?? c.name)[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        {child?.school_name && <p className="text-[10px] font-black text-amber-600 leading-none mb-0.5">{child.school_name}</p>}
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-gray-900 truncate">{child?.name ?? c.name}</p>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white shrink-0">
            <Sparkles size={9} />NEW
          </span>
        </div>
        {child
          ? <p className="text-xs text-gray-400 truncate">保護者: {c.name}{c.tel ? ` / ${c.tel}` : ''}</p>
          : c.tel && <p className="text-xs text-gray-400">{c.tel}</p>}
      </div>
      {c.line_user_id
        ? <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-full shrink-0">LINE</span>
        : <span className="text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">電話</span>}
    </button>
  )

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
        <Clock size={11} />最近登録されたお客様（15分以内）
      </p>
      <div className="border border-emerald-200 rounded-xl overflow-hidden shadow-sm">
        {recent.map(c =>
          withChildren && c.children && c.children.length > 0
            ? c.children.map(ch => <Row key={ch.id} c={c} child={ch} />)
            : <Row key={c.id} c={c} child={null} />,
        )}
      </div>
    </div>
  )
}
