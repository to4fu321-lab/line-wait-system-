'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CalendarCheck, MessageCircle, HandHelping, LogOut, Loader2, Clock, FilePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { Toast } from '@/app/_components/Toast'
import { MessageThread } from '../admin/shifts/_components/MessageThread'
import { StaffPinScreen } from './_components/StaffPinScreen'
import { MyShifts } from './_components/MyShifts'
import { SubmitRequest } from './_components/SubmitRequest'
import { HelpBoard } from './_components/HelpBoard'
import { ClockPanel } from './_components/ClockPanel'
import { LeaveForm } from './_components/LeaveForm'
import { SwapPanel } from './_components/SwapPanel'
import { PushOptIn } from './_components/PushOptIn'
import { ChatAssistant } from './_components/ChatAssistant'

const sb = supabase as any
type StaffSession = { id: string; name: string; role?: string | null; color?: string | null }
type Tab = 'mine' | 'clock' | 'apply' | 'messages' | 'help'
type ApplyTab = 'request' | 'leave' | 'swap' | 'chat'

export default function StaffPortal() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  const interStore = hasFeature('shift_inter_store')
  const useClock = hasFeature('shift_attendance')
  const useLeave = hasFeature('shift_leave')
  const useSwap = hasFeature('shift_swap')
  const usePush = hasFeature('staff_push')
  const useAi = hasFeature('shift_ai')

  const [storeName, setStoreName] = useState('')
  const [session, setSession] = useState<StaffSession | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('mine')
  const [applyTab, setApplyTab] = useState<ApplyTab>('request')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type })

  const sessKey = `staff_session_${storeId}`

  useEffect(() => {
    if (!storeId) return
    sb.from('stores').select('name').eq('id', storeId).single().then(({ data }: any) => setStoreName(data?.name ?? '店舗'))
    try { const raw = sessionStorage.getItem(sessKey); if (raw) setSession(JSON.parse(raw)) } catch {}
    setReady(true)
  }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const onAuth = (staff: StaffSession) => { setSession(staff); try { sessionStorage.setItem(sessKey, JSON.stringify(staff)) } catch {} }
  const logout = () => { setSession(null); try { sessionStorage.removeItem(sessKey) } catch {} }

  if (!ready || !loaded) return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  if (!hasFeature('shift_management')) {
    return <div className="min-h-[100dvh] grid place-items-center px-6 text-center text-gray-400">
      <p>この店舗ではシフト機能が有効になっていません。<br />店長にお問い合わせください。</p>
    </div>
  }

  if (!session) return <StaffPinScreen storeId={storeId} storeName={storeName} onAuth={onAuth} />

  const TABS: { id: Tab; label: string; icon: typeof CalendarCheck }[] = [
    { id: 'mine', label: 'マイシフト', icon: CalendarCheck },
    ...(useClock ? [{ id: 'clock' as Tab, label: '打刻', icon: Clock }] : []),
    { id: 'apply', label: '申請', icon: FilePlus },
    { id: 'messages', label: '連絡', icon: MessageCircle },
    ...(interStore ? [{ id: 'help' as Tab, label: 'ヘルプ', icon: HandHelping }] : []),
  ]

  const APPLY_TABS: { id: ApplyTab; label: string }[] = [
    { id: 'request', label: 'シフト希望' },
    ...(useLeave ? [{ id: 'leave' as ApplyTab, label: '休暇申請' }] : []),
    ...(useSwap ? [{ id: 'swap' as ApplyTab, label: 'シフト交換' }] : []),
    ...(useAi ? [{ id: 'chat' as ApplyTab, label: 'AIで申請' }] : []),
  ]
  const curApply = APPLY_TABS.some(t => t.id === applyTab) ? applyTab : 'request'

  return (
    <div className="max-w-lg mx-auto min-h-[100dvh] flex flex-col">
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3 sticky top-0 z-10">
        <span className="w-9 h-9 rounded-full grid place-items-center text-white font-black" style={{ background: session.color || '#6366f1' }}>
          {session.name.slice(0, 1)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{session.name} さん</p>
          <p className="text-[11px] text-gray-400 truncate">{storeName}{session.role ? `・${session.role}` : ''}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
          <LogOut size={14} />別の人に切替
        </button>
      </div>

      <div className="flex-1 px-4 py-4 pb-24">
        {tab === 'mine' && (
          <div className="space-y-4">
            {usePush && <PushOptIn storeId={storeId} staffId={session.id} />}
            <MyShifts staffId={session.id} homeStoreId={storeId} />
          </div>
        )}
        {tab === 'clock' && useClock && <ClockPanel storeId={storeId} staffId={session.id} />}
        {tab === 'apply' && (
          <div>
            {APPLY_TABS.length > 1 && (
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto">
                {APPLY_TABS.map(t => (
                  <button key={t.id} onClick={() => setApplyTab(t.id)}
                    className={`flex-1 min-w-[72px] py-2 rounded-lg text-xs font-bold whitespace-nowrap ${curApply === t.id ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>{t.label}</button>
                ))}
              </div>
            )}
            {curApply === 'request' && <SubmitRequest storeId={storeId} staffId={session.id} onToast={showToast} />}
            {curApply === 'leave' && useLeave && <LeaveForm storeId={storeId} staffId={session.id} onToast={showToast} />}
            {curApply === 'swap' && useSwap && <SwapPanel storeId={storeId} staffId={session.id} onToast={showToast} />}
            {curApply === 'chat' && useAi && <ChatAssistant storeId={storeId} staffId={session.id} onToast={showToast} />}
          </div>
        )}
        {tab === 'messages' && (
          <div>
            <p className="font-black text-gray-900 mb-2">店長とのやり取り</p>
            <MessageThread storeId={storeId} staffId={session.id} sender="staff" heightClass="h-[62vh]" />
          </div>
        )}
        {tab === 'help' && interStore && <HelpBoard storeId={storeId} staffId={session.id} onToast={showToast} />}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-lg mx-auto flex">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-bold">{t.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
