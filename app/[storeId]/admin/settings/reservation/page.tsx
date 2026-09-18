'use client'

// ============================================================
// 採寸予約設定
//
//  受付時間帯と枠数は「営業時間・試着室数・出勤シフト」から自動で決まる
//  （計算は lib/reservationCapacity）。この画面で店舗が触るのは
//    ① 採寸メニュー（名前と所要時間だけ。プリセットから選べる）
//    ② カレンダー上で、特定の日だけ休業にする／枠を増減する
//  の2つに絞っている。以前は曜日別の枠数7つと受付時間帯をメニューごとに
//  手入力させていて、営業時間・試着室数と二重管理になっていた。
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Plus, Trash2, CalendarClock, Clock, Users, DoorOpen, Info,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FeatureGuard } from '@/app/_components/FeatureGuard'
import { Toast } from '@/app/_components/Toast'
import { MonthCalendar } from '../../reservations/_components/MonthCalendar'
import { MENU_PRESETS, DURATION_OPTIONS } from '../../reservations/_lib/menuPresets'
import { capacityOf, loadCapacityInputs, CAPACITY_REASON_LABELS, type DayCapacity } from '@/lib/reservationCapacity'
import { holidayName } from '@/lib/japaneseHolidays'
import { todayJst } from '@/lib/date'

const sb = supabase as any

interface Menu {
  id?: string
  service_type: string
  label: string
  duration_min: number
  is_active: boolean
}

function fmtDate(d: string): string {
  const x = new Date(d + 'T12:00:00Z')
  const w = ['日', '月', '火', '水', '木', '金', '土'][x.getUTCDay()]
  return `${x.getUTCMonth() + 1}月${x.getUTCDate()}日（${w}）`
}

function ReservationSettingsPage() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  const router  = useRouter()

  const [menus,   setMenus]   = useState<Menu[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [adding,  setAdding]  = useState(false)

  // カレンダーで選んでいる日と、その日の枠
  const [date, setDate] = useState(todayJst())
  const [cap,  setCap]  = useState<DayCapacity | null>(null)
  const [capLoading, setCapLoading] = useState(true)
  const [calKey, setCalKey] = useState(0)   // 上書き保存後にカレンダーを再読込する

  const loadMenus = useCallback(async () => {
    setLoading(true)
    const { data, error } = await sb.from('reservation_settings')
      .select('id, service_type, label, duration_min, is_active')
      .eq('store_id', storeId).order('duration_min', { ascending: false })
    if (error) setToast({ type: 'err', msg: `読み込みに失敗しました: ${error.message}` })
    setMenus((data ?? []) as Menu[])
    setLoading(false)
  }, [storeId])

  const loadCap = useCallback(async () => {
    setCapLoading(true)
    const inputs = await loadCapacityInputs(storeId, date, date)
    setCap(capacityOf(date, inputs))
    setCapLoading(false)
  }, [storeId, date])

  useEffect(() => { if (storeId) loadMenus() }, [storeId, loadMenus])
  useEffect(() => { if (storeId) loadCap() }, [storeId, loadCap, calKey])

  // ── 採寸メニュー ──────────────────────────────────────────
  const addPreset = async (presetKey: string) => {
    const p = MENU_PRESETS.find(x => x.key === presetKey)
    if (!p) return
    // 同じ種別キーが既にあれば枝番をつけて重複を避ける
    let key = p.key
    for (let n = 2; menus.some(m => m.service_type === key); n++) key = `${p.key}${n}`
    setAdding(true)
    const { data, error } = await sb.from('reservation_settings').insert({
      store_id: storeId, service_type: key, label: p.label,
      duration_min: p.durationMin, is_active: true,
    }).select('id, service_type, label, duration_min, is_active').single()
    setAdding(false)
    if (error) { setToast({ type: 'err', msg: `追加に失敗しました: ${error.message}` }); return }
    setMenus(prev => [...prev, data as Menu])
    setToast({ type: 'ok', msg: `「${p.label}」を追加しました` })
  }

  const patchMenu = async (m: Menu, patch: Partial<Menu>) => {
    setMenus(prev => prev.map(x => x.id === m.id ? { ...x, ...patch } : x))
    const { error } = await sb.from('reservation_settings').update(patch).eq('id', m.id)
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); loadMenus(); return }
    setCalKey(k => k + 1)
  }

  const removeMenu = async (m: Menu) => {
    const { error } = await sb.from('reservation_settings').delete().eq('id', m.id)
    if (error) { setToast({ type: 'err', msg: `削除に失敗しました: ${error.message}` }); return }
    setMenus(prev => prev.filter(x => x.id !== m.id))
    setToast({ type: 'ok', msg: '削除しました' })
    setCalKey(k => k + 1)
  }

  // ── 日付ごとの例外 ────────────────────────────────────────
  const setOverride = async (maxSlots: number) => {
    const { error } = await sb.from('reservation_date_overrides')
      .upsert({ store_id: storeId, date, max_slots: maxSlots }, { onConflict: 'store_id,date' })
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setToast({ type: 'ok', msg: maxSlots === 0 ? `${fmtDate(date)}を休業にしました` : `${fmtDate(date)}の枠を${maxSlots}件にしました` })
    setCalKey(k => k + 1)
  }

  const clearOverride = async () => {
    const { error } = await sb.from('reservation_date_overrides')
      .delete().eq('store_id', storeId).eq('date', date)
    if (error) { setToast({ type: 'err', msg: `解除に失敗しました: ${error.message}` }); return }
    setToast({ type: 'ok', msg: '通常の設定に戻しました' })
    setCalKey(k => k + 1)
  }

  const holiday = holidayName(date)
  const isOverridden = cap?.reason === 'date_override' || cap?.reason === 'date_closed'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 to-violet-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base flex items-center gap-1.5">
            <CalendarClock size={18} />採寸予約設定
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-5">

        {/* ── 採寸メニュー ── */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1">採寸メニュー</h2>
          <p className="text-[11px] text-gray-500 px-1 leading-relaxed">
            お客様が予約時に選ぶ項目です。所要時間から自動で時間割を作ります。
          </p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" /></div>
          ) : menus.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-6 bg-white rounded-2xl border border-gray-200">
              まだメニューがありません。<br />下から選んで追加してください。
            </div>
          ) : (
            <div className="space-y-2">
              {menus.map(m => (
                <div key={m.id} className={`bg-white rounded-2xl border p-3 flex items-center gap-2.5 ${
                  m.is_active ? 'border-gray-200' : 'border-gray-200 opacity-50'
                }`}>
                  <input
                    value={m.label}
                    onChange={e => setMenus(prev => prev.map(x => x.id === m.id ? { ...x, label: e.target.value } : x))}
                    onBlur={e => patchMenu(m, { label: e.target.value.trim() || m.label })}
                    className="flex-1 min-w-0 border-0 border-b border-transparent hover:border-gray-200 focus:border-indigo-500 focus:outline-none font-bold text-gray-900 text-sm py-1 bg-transparent"
                  />
                  <select value={m.duration_min}
                    onChange={e => patchMenu(m, { duration_min: Number(e.target.value) })}
                    className="shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white">
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}分</option>)}
                    {!DURATION_OPTIONS.includes(m.duration_min) && <option value={m.duration_min}>{m.duration_min}分</option>}
                  </select>
                  <button onClick={() => patchMenu(m, { is_active: !m.is_active })}
                    title={m.is_active ? '受付を止める' : '受付を再開する'}
                    className={`shrink-0 px-2 py-1.5 rounded-lg text-[11px] font-bold ${
                      m.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                    {m.is_active ? '受付中' : '停止'}
                  </button>
                  <button onClick={() => removeMenu(m)}
                    className="shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* プリセットから追加 */}
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-3">
            <p className="text-[11px] font-bold text-gray-500 mb-2 flex items-center gap-1">
              <Plus size={13} />よくあるメニューから追加（名前・時間はあとで変えられます）
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {MENU_PRESETS.map(p => (
                <button key={p.key} onClick={() => addPreset(p.key)} disabled={adding}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 active:scale-[0.98] transition-all text-left disabled:opacity-50">
                  <span className="text-base leading-none shrink-0">{p.emoji}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold text-gray-800 truncate">{p.label}</span>
                    <span className="block text-[10px] text-gray-400">{p.durationMin}分</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 受付できる日と枠 ── */}
        <section className="space-y-2">
          <h2 className="text-sm font-black text-gray-800 px-1">受付できる日と枠</h2>
          <p className="text-[11px] text-gray-500 px-1 leading-relaxed">
            受付時間は<b>営業時間</b>、同時に受けられる件数は<b>試着室数と出勤人数</b>から自動で決まります。
            変えたい日だけカレンダーで指定してください。
          </p>

          <MonthCalendar key={calKey} storeId={storeId} value={date} onChange={setDate} />

          {/* 選択日の詳細と例外設定 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <p className="font-black text-gray-900">{fmtDate(date)}</p>
              {holiday && <span className="px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold border border-red-200">{holiday}</span>}
            </div>

            {capLoading || !cap ? (
              <div className="py-4 grid place-items-center"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-gray-50 py-2">
                    <p className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-0.5"><DoorOpen size={10} />受付</p>
                    <p className={`font-black ${cap.open ? 'text-emerald-600' : 'text-gray-400'}`}>{cap.open ? 'あり' : 'なし'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 py-2">
                    <p className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-0.5"><Clock size={10} />時間</p>
                    <p className="font-black text-gray-800 text-sm">{cap.open ? `${cap.startTime}–${cap.endTime}` : '—'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 py-2">
                    <p className="text-[10px] text-gray-400 font-bold flex items-center justify-center gap-0.5"><Users size={10} />同時</p>
                    <p className="font-black text-gray-800">{cap.maxSlots}<span className="text-xs">件</span></p>
                  </div>
                </div>

                <p className="text-[11px] text-gray-500 flex items-start gap-1 leading-relaxed">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  {CAPACITY_REASON_LABELS[cap.reason]}
                  {cap.staffOnDuty !== null && <>（出勤 {cap.staffOnDuty}名）</>}
                  {cap.staffOnDuty === null && cap.reason === 'rooms' && <>（シフト未登録の日は試着室数で判断します）</>}
                </p>

                {/* この日だけの変更 */}
                <div className="pt-1 border-t border-gray-100 space-y-2">
                  <p className="text-[11px] font-bold text-gray-500">この日だけ変更する</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setOverride(0)}
                      className="px-3 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold active:scale-95 transition-all">
                      休業にする
                    </button>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button key={n} onClick={() => setOverride(n)}
                        className="px-3 py-2 rounded-xl bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 text-xs font-bold active:scale-95 transition-all">
                        {n}件
                      </button>
                    ))}
                    {isOverridden && (
                      <button onClick={clearOverride}
                        className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold active:scale-95 transition-all">
                        通常に戻す
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3">
            <p className="text-[11px] text-indigo-900 leading-relaxed">
              営業時間・定休日を変えるときは<button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
                className="underline font-bold">設定 → 営業時間</button>、
              試着室数は<button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
                className="underline font-bold">同じ設定画面</button>から変更できます。
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

export default function Page() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  return (
    <FeatureGuard storeId={storeId} feature="reservation">
      <ReservationSettingsPage />
    </FeatureGuard>
  )
}
