'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, RotateCcw,
  Banknote, Pencil, Truck, Trash2, Camera, X, Printer,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { REPAIR_PHOTOS_BUCKET } from '@/types/repair'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { REPAIR_LABELS as labels } from '@/lib/repairProfile'
import { StaffPicker, lastStaffId, useStaffList } from './StaffPicker'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS,
  REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS, REPAIR_TYPE_COLORS,
} from '@/types/crm'
import type { RequestType } from '@/types/crm'
import { fmtDate, fmtReqNo } from './utils'
import type { RepairRow } from './types'
import { RepairPrintModal, type PrintableRepair } from './RepairPrintSlip'

export function RepairCard({ item, storeId, storeName = '', onRefresh, onToast, onEdit, selected, onToggle, isSimpleMode = false, isTablet = false }: {
  item: RepairRow; storeId: string; storeName?: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: RepairRow) => void
  selected?: boolean
  onToggle?: () => void
  isSimpleMode?: boolean
  isTablet?: boolean
}) {
  // PCモード(isTablet)では固定の極小フォントだと読みづらいため、一回り大きいサイズに切替える
  const tx = (mobile: string, tablet: string) => isTablet ? tablet : mobile
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const [confirmPay,    setConfirmPay]    = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmVendor, setConfirmVendor] = useState(false)
  const [confirmInspect, setConfirmInspect] = useState(false)
  const [inspectOk,      setInspectOk]    = useState(false)
  const [vendorName,    setVendorName]    = useState('')
  const [vendorId,      setVendorId]      = useState<string | null>(null)
  const [expectedReturn, setExpectedReturn] = useState('')
  const [vendors,       setVendors]       = useState<{ id: string; name: string }[]>([])
  const [completionPhotos, setCompletionPhotos] = useState<{ file: File; url: string }[]>([])
  const [repairPhotos, setRepairPhotos] = useState<{ phase: string; url: string }[] | null>(null)
  const [photosOpen,   setPhotosOpen]   = useState(false)
  // 一覧は「次に何をやるか」の判断に絞る。金額・日付・詳細は畳んで、
  // 同じトグル（下部の「…」行）でまとめて開く。
  const detailOpen = photosOpen
  // 作業・連絡の担当。完了時に必ず選ばせる（誰がやったか後で分からなくなるため）
  const staffCount = useStaffList(storeId).length
  const [doneBy, setDoneBy] = useState<string | null>(null)
  useEffect(() => { setDoneBy(item.strung_by ?? lastStaffId(storeId)) }, [item.strung_by, storeId])
  const staffMissing = staffCount > 0 && !doneBy
  const [printOpen,    setPrintOpen]    = useState(false)
  const photosLoadedRef = useRef(false)

  // 外注先へそのまま渡せる依頼書（価格は含めない）
  const printableItem: PrintableRepair = {
    reqNo: fmtReqNo('repair', item.request_no, item.id),
    garmentName: item.garment_name ?? '',
    itemName: item.item_name,
    content: item.content,
    schoolName: item.child?.school_name ?? null,
    childName: item.child?.name ?? null,
    customerName: item.customer?.name ?? '',
    receivedDate: item.received_date,
    desiredDate: item.desired_completion_date,
    vendorName: item.vendor_name,
    memo: item.internal_memo,
    hemLengthMm: item.hem_length_mm,
    sleeveAdjustMm: item.sleeve_adjust_mm,
    waistAdjustMm: item.waist_adjust_mm,
    embroideryText: item.embroidery_text,
    embroideryColor: item.embroidery_color,
    embroideryPos: item.embroidery_pos,
  }

  const { hasFeature } = useStoreFeatures(storeId)
  const smsEnabled = hasFeature('sms_notify') // アドオン未契約なら false → 電話連絡ステップ

  const reqType = (item.request_type ?? 'repair') as RequestType
  const name    = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deadlineDate = item.desired_completion_date ? new Date(item.desired_completion_date) : null
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0)
  const daysLeft   = deadlineDate ? Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000) : null
  const isOverdue  = daysLeft !== null && daysLeft < 0
  const isDueSoon  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1

  const pubUrl = (path: string) =>
    supabase.storage.from(REPAIR_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl

  async function uploadCompletionPhotos() {
    for (let i = 0; i < completionPhotos.length; i++) {
      const f = completionPhotos[i].file
      const ext = f.name.split('.').pop() || 'jpg'
      const path = `repairs/${storeId}/${item.id}/after_${Date.now()}_${i}.${ext}`
      const { error } = await supabase.storage.from(REPAIR_PHOTOS_BUCKET).upload(path, f, { upsert: true })
      if (!error) {
        await (supabase as any).from('repair_photos').insert({
          store_id: storeId, repair_id: item.id, phase: 'after', path, url: pubUrl(path),
        })
      }
    }
    setCompletionPhotos([])
    photosLoadedRef.current = false  // invalidate cache so display refreshes
    setRepairPhotos(null)
  }

  // 外注確認パネルが開いたときに業者マスタを読み込む
  useEffect(() => {
    if (!confirmVendor || vendors.length > 0) return
    ;(supabase as any).from('repair_vendors')
      .select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => setVendors(data ?? []))
  }, [confirmVendor, storeId, vendors.length])

  // lazy-load photos when card is expanded (full mode) or photos panel opened
  useEffect(() => {
    if ((!open && !photosOpen) || photosLoadedRef.current) return
    photosLoadedRef.current = true
    ;(async () => {
      const { data } = await (supabase as any)
        .from('repair_photos')
        .select('phase, url')
        .eq('repair_id', item.id)
        .order('created_at', { ascending: true })
      setRepairPhotos(data ?? [])
    })()
  }, [open, photosOpen, item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function update(patch: Record<string, unknown>, msg: string, undoPatch?: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('repair_histories')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('repair_histories')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  // お直し完了時、実際にLINE/SMSで通知する（従来は notified:true を立てるだけで送信されていなかった）
  const fullNotifyMode: 'line' | 'sms' | 'phone_manual' | 'none' =
    item.customer?.line_user_id ? 'line' : item.customer?.tel ? (smsEnabled ? 'sms' : 'phone_manual') : 'none'

  async function handleRepairComplete() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const markNotifiedNow = fullNotifyMode !== 'line' && fullNotifyMode !== 'sms'
    const { error } = await (supabase as any).from('repair_histories')
      .update({ status: 'completed', completed_date: today, ...(markNotifiedNow ? { notified: true } : {}),
                ...(item.strung_by ? {} : { strung_by: doneBy }),
                updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (error) { setLoading(false); onToast('err', '更新に失敗しました'); return }
    let outsideHours = false
    if (fullNotifyMode === 'line' || fullNotifyMode === 'sms') {
      try {
        const res = await fetch('/api/notify-repair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repairId: item.id,
            lineUserId: item.customer?.line_user_id ?? null,
            tel: item.customer?.tel ?? null,
            customerName: item.customer?.name ?? '',
            itemName: item.item_name,
            storeName,
            reqNo: fmtReqNo('repair', item.request_no, item.id),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.ok) {
          setLoading(false); onRefresh()
          onToast('err', `通知送信に失敗しました: ${(json as any).error ?? '不明なエラー'}`)
          return
        }
        // 閉店間際・定休日に送った場合は現場に知らせる（送信自体は済んでいる）
        outsideHours = (json as any).outsideHours === true
      } catch (e) {
        setLoading(false); onRefresh()
        onToast('err', `通知エラー: ${String(e)}`)
        return
      }
    }
    setLoading(false); onRefresh()
    if (outsideHours) {
      onToast('ok', '完了・通知しました（営業時間外のため、ご来店は次の営業日になります）')
      return
    }
    onToast('ok', fullNotifyMode === 'line' ? '完了・LINEで通知しました' : fullNotifyMode === 'sms' ? '完了・SMSで通知しました' : '完了にしました')
  }

  // Primary action config
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (reqType === 'repair') {
    if (item.sent_to_vendor_at && !item.work_started) {
      // 外注中は「外注品が戻ってきた（検品へ）」から検品を経て再開する（下の外注ボタン参照）
      primaryBtn = null
    } else if (!item.work_started) {
      primaryBtn = {
        label: '✂️ 作業開始',
        color: 'bg-amber-500 hover:bg-amber-400 shadow-amber-200',
        onClick: () => update({ work_started: true }, '作業開始しました', { work_started: false }),
      }
    } else {
      primaryBtn = {
        label: '✅ 完了',
        color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
        onClick: handleRepairComplete,
      }
    }
  } else if (reqType === 'walk_in') {
    primaryBtn = {
      label: '✅ 対応完了・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true, ...(item.strung_by ? {} : { strung_by: doneBy }) },
        '対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'hold_request') {
    primaryBtn = {
      label: '✅ 確保済み・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true, ...(item.strung_by ? {} : { strung_by: doneBy }) },
        '確保済みにしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'inquiry') {
    primaryBtn = {
      label: '✅ 問合せ対応完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true, ...(item.strung_by ? {} : { strung_by: doneBy }) },
        '問合せ対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'repair_consult') {
    primaryBtn = {
      label: '✅ 相談完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true, ...(item.strung_by ? {} : { strung_by: doneBy }) },
        '相談完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'payment_pending') {
    primaryBtn = {
      label: '✅ 入金確認・回収完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true, ...(item.strung_by ? {} : { strung_by: doneBy }) },
        '入金確認・回収完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  }

  // 受付時に聞いた内容のスナップショット。これがあるなら、全部つなげた1文字列の
  // content より、ラベル付きで並べたほうが読みやすい（content は truncate で切れる）
  const details = item.input_details ?? []
  const hasDetails = details.length > 0

  const cardBg =
    isOverdue  ? 'bg-red-50 border-2 border-red-400' :
    isDueSoon  ? 'bg-amber-50 border-2 border-amber-400' :
    item.work_started ? 'bg-amber-50/50 border border-amber-200' :
    'bg-white border border-gray-200'

  // ── シンプルモード ───────────────────────────────────────────────
  if (isSimpleMode) {
    const reqNo = fmtReqNo('repair', item.request_no, item.id)
    const hasLine = !!item.customer?.line_user_id
    const hasTel  = !!item.customer?.tel
    // SMSアドオン未契約(smsEnabled=false)で電話のみの顧客は「電話連絡」運用
    const notifyMode: 'line' | 'sms' | 'phone_manual' | 'none' =
      hasLine ? 'line' : hasTel ? (smsEnabled ? 'sms' : 'phone_manual') : 'none'
    const confirmText =
      notifyMode === 'line' ? 'LINEで通知して完了にしますか？' :
      notifyMode === 'sms'  ? 'SMSで通知して完了にしますか？' :
                              '完了にしますか？（通知なし）'
    const completeToast =
      notifyMode === 'line'         ? '✅ 完了・LINEで通知しました' :
      notifyMode === 'sms'          ? '✅ 完了・SMSで通知しました' :
                                      '✅ 完了にしました'

    const handlePaymentToggle = async () => {
      const newPrepaid = !item.prepaid
      setLoading(true)
      const { error } = await (supabase as any).from('repair_histories')
        .update({ prepaid: newPrepaid, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      setLoading(false)
      if (error) { onToast('err', '支払状態の更新に失敗しました'); return }
      onRefresh()
      onToast(
        'ok',
        newPrepaid ? '💰 支払い済みにしました' : '⚠️ 未払いに戻しました',
        async () => {
          await (supabase as any).from('repair_histories')
            .update({ prepaid: !newPrepaid, updated_at: new Date().toISOString() })
            .eq('id', item.id)
          onRefresh()
        }
      )
    }

    const handleSimpleComplete = async () => {
      setLoading(true)
      if (completionPhotos.length > 0) await uploadCompletionPhotos()
      const today = new Date().toISOString().slice(0, 10)
      // 電話連絡運用は手動連絡済みなので notified:true で確定（SMS送信はしない）
      const markNotified = notifyMode === 'phone_manual'
      const { error } = await (supabase as any).from('repair_histories')
        // 担当者を必須で選ばせているのに保存していなかったため、誰が仕上げたか
        // が一切残っていなかった（画面には「作業・連絡」欄が出ない）
        .update({ status: 'completed', completed_date: today, work_started: true,
                  ...(markNotified ? { notified: true } : {}),
                  ...(item.strung_by ? {} : { strung_by: doneBy }),
                  updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) { setLoading(false); onToast('err', '更新に失敗しました'); return }
      if (notifyMode === 'line' || notifyMode === 'sms') {
        try {
          const res = await fetch('/api/notify-repair', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              repairId:     item.id,
              lineUserId:   item.customer?.line_user_id ?? null,
              tel:          item.customer?.tel ?? null,
              customerName: item.customer?.name ?? '',
              itemName:     item.item_name,
              storeName,
              reqNo,
            }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok || !json.ok) {
            setLoading(false)
            onRefresh()
            onToast('err', `通知送信に失敗しました: ${(json as any).error ?? '不明なエラー'}`)
            return
          }
        } catch (e) {
          setLoading(false)
          onRefresh()
          onToast('err', `通知エラー: ${String(e)}`)
          return
        }
      }
      setLoading(false)
      onRefresh()
      onToast('ok', completeToast)
    }

    const handleSendToVendor = async () => {
      setLoading(true)
      const { error } = await (supabase as any).from('repair_histories')
        .update({
          sent_to_vendor_at: new Date().toISOString().slice(0, 10),
          vendor_id: vendorId || null,
          vendor_name: vendorName.trim() || null,
          expected_return_date: expectedReturn || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
      setLoading(false)
      setConfirmVendor(false)
      setVendorName(''); setVendorId(null); setExpectedReturn('')
      if (error) { onToast('err', '外注登録に失敗しました'); return }
      onRefresh()
      onToast('ok', '📤 業者さんに出しました')
    }

    const handleReturnFromVendor = async () => {
      setLoading(true)
      const { error } = await (supabase as any).from('repair_histories')
        .update({ work_started: true, inspected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', item.id)
      setLoading(false)
      if (error) { onToast('err', '更新に失敗しました'); return }
      onRefresh()
      onToast('ok', '📥 確認OK・作業を続けます')
    }

    const handleSimpleRevert = async () => {
      setLoading(true)
      const { error } = await (supabase as any).from('repair_histories')
        .update({ status: 'received', work_started: false, completed_date: null, notified: false, sent_to_vendor_at: null, vendor_name: null, inspected_at: null, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      setLoading(false)
      if (error) { onToast('err', '更新に失敗しました'); return }
      onRefresh()
      onToast('ok', '受付中に戻しました')
    }

    const canRevert = item.work_started || !!item.sent_to_vendor_at

    const leftBorderColor =
      isOverdue            ? 'border-l-red-500' :
      isDueSoon            ? 'border-l-amber-500' :
      item.sent_to_vendor_at ? 'border-l-orange-400' :
      item.work_started    ? 'border-l-emerald-400' : 'border-l-indigo-400'

    return (
      <div
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${leftBorderColor} cursor-pointer`}
        onClick={e => {
          // カードのどこを触っても開閉する。操作系の上では無効。
          if ((e.target as HTMLElement).closest('button, a, input, label, textarea, select')) return
          setPhotosOpen(v => !v)
        }}>
        <div className="p-3.5 space-y-2">
          {/* バッジ + 受付番号 */}
          <div className="flex items-center justify-between gap-2">
            <div className={tx('text-xs', 'text-sm') + ' flex items-center gap-1.5 flex-wrap'}>
              <span className={`font-black px-2.5 py-1 rounded-lg ${REQUEST_TYPE_COLORS[reqType]}`}>
                {REQUEST_TYPE_LABELS[reqType]}
              </span>
              {item.sent_to_vendor_at ? (
                <span className="font-black text-orange-600">🏭 業者さんに依頼中{detailOpen && item.vendor_name ? `（${item.vendor_name}）` : ''}</span>
              ) : detailOpen && item.vendor_name ? (
                <span className="font-black text-slate-500">📤 業者さんに出す予定（{item.vendor_name}）</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {detailOpen && (
                <button onClick={() => setPrintOpen(true)} style={{ touchAction: 'manipulation' }}
                  className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all">
                  <Printer size={16} />
                </button>
              )}
              <span className={tx('text-base', 'text-xl') + ' font-black text-indigo-500 font-mono'}>{reqNo}</span>
              {detailOpen ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
            </div>
          </div>

          {/* 顧客名 ｜ 大項目 ｜ お直し内容（1行にまとめる） */}
          <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
            {item.child?.school_name && (
              <span className={tx('text-xs', 'text-sm') + ' font-black text-amber-600'}>{item.child.school_name}</span>
            )}
            {item.garment_name && (
              <span className={tx('text-xs', 'text-sm') + ' font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded'}>{item.garment_name}</span>
            )}
            <span className={tx('text-lg', 'text-xl') + ' font-black text-gray-900 leading-tight'}>{name}</span>
            <span className="text-gray-300 font-black">｜</span>
            {/* 畳んだ時は作業名だけ。ポンド数などの内訳は展開時に出す。 */}
            {/* 種類バッジと同じ文字列なら重ねて出さない */}
            {(() => {
              // 内訳（input_details）を出すときは、同じ内容を並べた content は出さない
              const hasDetails = (item.input_details?.length ?? 0) > 0
              const work = (detailOpen && !hasDetails)
                ? (item.content || item.item_name || '内容未記入')
                : (item.item_name || item.content || '内容未記入')
              if (work === item.garment_name) return null
              return (
                <span className={tx('text-base', 'text-lg') + ' font-black text-gray-900 leading-tight'}>{work}</span>
              )
            })()}
            {detailOpen && item.child?.name && item.customer?.name && (
              <span className={tx('text-[11px]', 'text-xs') + ' text-gray-400'}>（保護者: {item.customer.name}）</span>
            )}
          </div>

          {/* 受付内容の内訳（ラケット・糸・ポンド数・巻き・希望…） */}
          {detailOpen && (item.input_details?.length ?? 0) > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 space-y-1">
              {item.input_details!.map((d, i) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="w-24 shrink-0 text-[11px] font-bold text-gray-400">{d.label}</span>
                  <span className="font-black text-gray-800 break-all">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 担当スタッフ（受付・作業） */}
          {detailOpen && (item.received_by_staff?.name || item.strung_by_staff?.name) && (
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs">
              {item.received_by_staff?.name && (
                <span className="text-gray-500">受付 <span className="font-black text-gray-800">{item.received_by_staff.name}</span></span>
              )}
              {item.strung_by_staff?.name && (
                <span className="text-gray-500">作業・連絡 <span className="font-black text-gray-800">{item.strung_by_staff.name}</span></span>
              )}
            </div>
          )}

          {/* 詳細の希望・スタッフメモ */}
          {detailOpen && item.notes && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-[10px] font-bold text-blue-500 mb-0.5">ご希望・メモ</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
          {detailOpen && item.internal_memo && (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2">
              <p className="text-[10px] font-bold text-yellow-600 mb-0.5">スタッフメモ</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.internal_memo}</p>
            </div>
          )}

          {/* 詳細（mm・刺繍）— 一覧では畳む */}
          {detailOpen && item.repair_type === 'hem' && item.hem_length_mm != null && item.hem_length_mm !== 0 && (
            <p className="text-sm font-black text-amber-700">裾上げ {item.hem_length_mm > 0 ? '+' : ''}{item.hem_length_mm}mm</p>
          )}
          {detailOpen && item.repair_type === 'sleeve' && item.sleeve_adjust_mm != null && item.sleeve_adjust_mm !== 0 && (
            <p className="text-sm font-black text-blue-700">袖丈 {item.sleeve_adjust_mm > 0 ? '+' : ''}{item.sleeve_adjust_mm}mm</p>
          )}
          {detailOpen && item.repair_type === 'waist' && item.waist_adjust_mm != null && item.waist_adjust_mm !== 0 && (
            <p className="text-sm font-black text-purple-700">ウエスト {item.waist_adjust_mm > 0 ? '+' : ''}{item.waist_adjust_mm}mm</p>
          )}
          {detailOpen && item.repair_type === 'embroidery' && item.embroidery_text && (
            <p className="text-sm font-black text-pink-700">刺繍「{item.embroidery_text}」{item.embroidery_color} {item.embroidery_pos}</p>
          )}

          {/* 納期は常に見せる（次に何をやるかの判断に要る）。
              金額・受付日は展開時のみ（作業中は使わない情報） */}
          {!detailOpen && (() => {
            const size = item.input_details?.find(d => d.label.startsWith('サイズ'))?.value
            return size ? (
              <span className="inline-block rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-black text-amber-700">
                サイズ {size}
              </span>
            ) : null
          })()}
          {!detailOpen && (
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-black ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
                {item.desired_completion_date
                  ? <>{isOverdue ? '🚨' : isDueSoon ? '⚠️' : '📅'} 希望 {fmtDate(item.desired_completion_date)}</>
                  : <span className="text-gray-400">納期未設定</span>}
              </span>
              {!confirmPrimary && (
                <button onClick={() => setConfirmPrimary(true)} disabled={loading}
                  style={{ touchAction: 'manipulation' }}
                  className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black active:scale-95 transition-all disabled:opacity-50">
                  ✅ 完了
                </button>
              )}
            </div>
          )}
          <div className={`items-center gap-x-3 gap-y-1 flex-wrap ${detailOpen ? 'flex' : 'hidden'}`}>
            {item.price != null && (
              <button onClick={handlePaymentToggle} disabled={loading}
                style={{ touchAction: 'manipulation' }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 font-black transition-all active:scale-[0.98] disabled:opacity-50 ${
                  item.prepaid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-300 text-red-700'
                }`}>
                <Banknote size={16} className="shrink-0" />
                <span className="text-base">¥{item.price.toLocaleString()}</span>
                <span className={`text-[11px] px-1.5 py-0 rounded font-black leading-5 ${
                  item.prepaid ? 'bg-emerald-200/60 text-emerald-800' : 'bg-red-200/60 text-red-800'
                }`}>
                  {item.prepaid ? '支払済' : '未払い'}
                </span>
              </button>
            )}
            <span className="flex items-center gap-2 text-sm">
              <span className="font-bold text-gray-400">受付 {fmtDate(item.received_date)}</span>
              {item.desired_completion_date && (
                <>
                  <span className="text-gray-300 font-black">→</span>
                  <span className={`font-black ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-700'}`}>
                    {isOverdue ? '🚨' : isDueSoon ? '⚠️' : '📅'} 希望 {fmtDate(item.desired_completion_date)}
                  </span>
                </>
              )}
            </span>
          </div>

          {/* アクション: 完了 ＋ 外注（畳んでいる間は隠す。確認中は必ず出す） */}
          <div className={`border-t border-gray-100 pt-2 ${
            detailOpen || confirmPrimary || confirmVendor || confirmInspect ? '' : 'hidden'
          }`}>
          {confirmPrimary ? (
            notifyMode === 'phone_manual' ? (
              /* SMS未契約: 電話連絡をうながす2ステップ */
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 space-y-2">
                <p className="text-sm text-center text-emerald-800 font-black">📞 お客様へ電話連絡をしてください</p>
                {item.customer?.tel && (
                  <a href={`tel:${item.customer.tel}`}
                    className="flex items-center justify-center gap-2 py-2 rounded-xl bg-white border-2 border-emerald-200 text-emerald-700 text-base font-black active:scale-95 transition-all"
                    style={{ touchAction: 'manipulation' }}>
                    <Phone size={16} /> {item.customer.tel} に発信
                  </a>
                )}
                <CompletionPhotoCapture photos={completionPhotos} onAdd={f => setCompletionPhotos(cp => [...cp, f])} onRemove={i => setCompletionPhotos(cp => cp.filter((_, j) => j !== i))} />
                <StaffPicker storeId={storeId} label="作業・連絡した人（必須）" value={doneBy} onChange={setDoneBy} />
                <div className="flex gap-2">
                  <button onClick={() => setConfirmPrimary(false)}
                    className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all"
                    style={{ touchAction: 'manipulation' }}>
                    戻る
                  </button>
                  <button onClick={() => { setConfirmPrimary(false); handleSimpleComplete() }} disabled={loading || staffMissing}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50"
                    style={{ touchAction: 'manipulation' }}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    電話連絡完了
                  </button>
                </div>
              </div>
            ) : (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 space-y-2">
              <p className="text-sm text-center text-emerald-800 font-black">{confirmText}</p>
              <CompletionPhotoCapture photos={completionPhotos} onAdd={f => setCompletionPhotos(cp => [...cp, f])} onRemove={i => setCompletionPhotos(cp => cp.filter((_, j) => j !== i))} />
              <StaffPicker storeId={storeId} label="作業・連絡した人（必須）" value={doneBy} onChange={setDoneBy} />
              <div className="flex gap-2">
                <button onClick={() => setConfirmPrimary(false)}
                  className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all"
                  style={{ touchAction: 'manipulation' }}>
                  戻る
                </button>
                <button onClick={() => { setConfirmPrimary(false); handleSimpleComplete() }} disabled={loading || staffMissing}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50"
                  style={{ touchAction: 'manipulation' }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {notifyMode === 'none' ? '完了にする' : '完了・通知する'}
                </button>
              </div>
            </div>
            )
          ) : confirmVendor ? (
            <div className="rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 space-y-2.5">
              <p className="text-sm font-black text-orange-800 text-center">📤 業者さんに出す</p>
              {/* 業者マスタ選択 */}
              {vendors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => { setVendorName(''); setVendorId(null) }}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all ${vendorName === '' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                    未定
                  </button>
                  {vendors.map(v => (
                    <button type="button" key={v.id} onClick={() => { setVendorName(v.name); setVendorId(v.id) }}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all ${vendorId === v.id ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-700'}`}>
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
              {/* 直接入力（マスタ外の業者） */}
              <input
                value={vendorName}
                onChange={e => { setVendorName(e.target.value); setVendorId(null) }}
                placeholder={vendors.length > 0 ? 'または業者名を直接入力' : '業者・仕立て屋名（任意）'}
                className="w-full px-3 py-2 rounded-xl border border-orange-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                style={{ touchAction: 'manipulation' }}
              />
              {/* 戻り予定日 */}
              <div>
                <label className="text-[10px] font-bold text-orange-700 block mb-1">戻り予定日（任意）</label>
                <input type="date" value={expectedReturn} onChange={e => setExpectedReturn(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-orange-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  style={{ touchAction: 'manipulation' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmVendor(false); setVendorName(''); setVendorId(null); setExpectedReturn('') }}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all">
                  戻る
                </button>
                <button onClick={handleSendToVendor} disabled={loading}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-orange-600 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : '📤'}
                  業者さんに出す
                </button>
              </div>
            </div>
          ) : confirmInspect ? (
            <div className="rounded-xl border-2 border-teal-300 bg-teal-50 px-3 py-2.5 space-y-2.5">
              <p className="text-sm font-black text-teal-800 text-center">📥 品物が戻りました。中身を確認してください</p>
              <label className="flex items-center gap-2 bg-white rounded-xl border border-teal-200 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" checked={inspectOk} onChange={e => setInspectOk(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                <span className="text-xs font-bold text-gray-700">仕上がり・汚れ・破損がないか確認しました</span>
              </label>
              <div className="flex gap-2">
                <button onClick={() => { setConfirmInspect(false); setInspectOk(false) }}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all">
                  戻る
                </button>
                <button onClick={() => { setConfirmInspect(false); setInspectOk(false); handleReturnFromVendor() }} disabled={loading || !inspectOk}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2 rounded-xl bg-teal-600 text-white text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  確認OK・作業を続ける
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!(item.sent_to_vendor_at && !item.work_started) && (
                <button onClick={() => setConfirmPrimary(true)} disabled={loading}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-[2] py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-base rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : '✅'} 完了
                </button>
              )}
              {!item.sent_to_vendor_at ? (
                <button onClick={() => setConfirmVendor(true)} disabled={loading}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-3.5 border-2 border-orange-200 bg-orange-50 text-orange-700 font-black text-base rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                  📤 業者さんへ
                </button>
              ) : !item.work_started ? (
                <button onClick={() => setConfirmInspect(true)} disabled={loading}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-[2] py-3.5 border-2 border-teal-200 bg-teal-50 text-teal-700 font-black text-base rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : '📥'} 戻ってきた（確認する）
                </button>
              ) : null}
            </div>
          )}
          </div>

          {/* 開閉はカード全体のタップで行う。開いている時だけ「閉じる」を出す。 */}
          {photosOpen && (
            <button onClick={() => setPhotosOpen(false)}
              style={{ touchAction: 'manipulation' }}
              className="w-full flex items-center justify-center gap-1 text-[11px] text-gray-400 font-bold pt-0.5 active:opacity-60">
              <ChevronUp size={12} />閉じる
            </button>
          )}

          {photosOpen && (
            <div className="space-y-2.5 pt-2 border-t border-gray-100">
              {/* 電話 */}
              {item.customer?.tel && (
                <a href={`tel:${item.customer.tel}`}
                  className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
                  <Phone size={14} className="shrink-0" />{item.customer.tel}
                </a>
              )}

              {/* 写真 */}
              <div>
                <p className="flex items-center gap-1 text-[11px] text-gray-400 font-bold mb-1">
                  <Camera size={11} className="shrink-0" />
                  写真{repairPhotos && repairPhotos.length > 0 ? ` (${repairPhotos.length})` : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {repairPhotos == null ? (
                    <Loader2 size={14} className="animate-spin text-gray-300" />
                  ) : repairPhotos.length === 0 ? (
                    <p className="text-[10px] text-gray-300">写真なし</p>
                  ) : repairPhotos.map((p, i) => (
                    <div key={i} className="relative w-14 h-14 shrink-0">
                      <img src={p.url} alt="" className="w-full h-full object-cover rounded-lg border" />
                      <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5 rounded-b-lg ${p.phase === 'after' ? 'bg-emerald-600/70 text-white' : 'bg-black/40 text-white'}`}>
                        {p.phase === 'after' ? '完了時' : '受付時'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 受付に戻す + 削除 */}
              {confirmCancel ? (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 space-y-2">
                  <p className="text-sm font-black text-red-700 text-center">本当に削除しますか？</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCancel(false)}
                      style={{ touchAction: 'manipulation' }}
                      className="flex-1 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-black active:scale-95 transition-all">
                      戻る
                    </button>
                    <button onClick={async () => {
                      setLoading(true)
                      const { error } = await (supabase as any).from('repair_histories').delete().eq('id', item.id)
                      setLoading(false)
                      if (error) { onToast('err', '削除に失敗しました'); return }
                      onToast('ok', 'キャンセルしました')
                      onRefresh()
                    }} disabled={loading}
                      style={{ touchAction: 'manipulation' }}
                      className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50">
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={14} />削除する</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {canRevert && (
                    <button onClick={handleSimpleRevert} disabled={loading}
                      style={{ touchAction: 'manipulation' }}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 bg-gray-50 text-gray-500 font-bold text-xs rounded-lg active:scale-95 transition-all">
                      <RotateCcw size={11} />受付に戻す
                    </button>
                  )}
                  <span className="flex-1" />
                  <button onClick={() => setConfirmCancel(true)} disabled={loading}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-red-100 bg-red-50 text-red-400 font-bold text-xs rounded-lg active:scale-95 transition-all">
                    <Trash2 size={11} />削除
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {printOpen && <RepairPrintModal items={[printableItem]} storeName={storeName} onClose={() => setPrintOpen(false)} />}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm transition-all ${cardBg}${selected ? ' ring-2 ring-indigo-500/50 ring-offset-1' : ''}`}>
      {/* Urgency accent strip */}
      {(isOverdue || isDueSoon) && (
        <div className={`h-1 w-full ${isOverdue ? 'bg-red-500' : 'bg-amber-400'}`} />
      )}
      <div className="flex items-stretch">
        {onToggle && (
          <button onClick={onToggle}
            className={`shrink-0 w-12 flex items-center justify-center transition-colors ${
              selected ? 'bg-indigo-50' : 'hover:bg-gray-50'
            } border-r ${selected ? 'border-indigo-200' : 'border-gray-100'}`}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              selected ? 'border-indigo-600 bg-indigo-600 scale-110' : 'border-gray-300'
            }`}>
              {selected && <Check size={10} className="text-white" />}
            </div>
          </button>
        )}
        <div className="flex-1 min-w-0 overflow-hidden">
      <div className="flex items-stretch">
      {/* Clickable summary area */}
      <button className="flex-1 min-w-0 text-left px-3 pt-2 pb-2 flex items-start gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          {/* Row 1: badges + deadline */}
          <div className={tx('text-[9px]', 'text-xs') + ' flex items-center gap-1 mb-0.5 flex-wrap'}>
            <span className={`px-1.5 py-0 rounded-full border font-bold leading-5 ${REQUEST_TYPE_COLORS[reqType]}`}>
              {REQUEST_TYPE_LABELS[reqType]}
            </span>
            {item.repair_type && (
              <span className={`px-1.5 py-0 rounded-full border font-bold leading-5 ${REPAIR_TYPE_COLORS[item.repair_type]}`}>
                {REPAIR_TYPE_ICONS[item.repair_type]} {REPAIR_TYPE_LABELS[item.repair_type]}
              </span>
            )}
            {item.sent_to_vendor_at ? (
              <span className="px-1.5 py-0 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-bold leading-5">🏭外注中</span>
            ) : item.vendor_name ? (
              <span className="px-1.5 py-0 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold leading-5 max-w-[8rem] truncate">📤外注予定 {item.vendor_name}</span>
            ) : null}
            {item.is_rework && <span className="px-1.5 py-0 rounded-full bg-red-100 text-red-700 border border-red-200 font-bold leading-5">再加工</span>}
            {isOverdue && <span className="px-1.5 py-0 rounded-full bg-red-600 text-white font-black leading-5 animate-pulse">🚨{Math.abs(daysLeft!)}日超過</span>}
            {isDueSoon && !isOverdue && <span className="px-1.5 py-0 rounded-full bg-amber-500 text-white font-black leading-5">⚠️期限間近</span>}
            {!item.prepaid && <span className="px-1.5 py-0 rounded-full bg-red-600 text-white font-black leading-5 animate-pulse">未払い</span>}
            <span className="flex-1" />
            {item.desired_completion_date && (
              <span className={`font-bold shrink-0 ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                希望{fmtDate(item.desired_completion_date)}
              </span>
            )}
          </div>

          {/* Row 2: 大項目 + アイテム名 + 内容 + 金額 */}
          <div className="flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              {(item.garment_name || (item.item_name && item.content && item.item_name !== item.content)) && (
                <p className={tx('text-[10px]', 'text-xs') + ' text-gray-400 truncate leading-none mb-0.5'}>
                  {item.garment_name && <span className="font-bold text-indigo-500">{item.garment_name}</span>}
                  {item.garment_name && item.item_name && item.content && item.item_name !== item.content && ' ・ '}
                  {item.item_name && item.content && item.item_name !== item.content && item.item_name}
                </p>
              )}
              <p className={tx('text-sm', 'text-lg') + ' font-black text-gray-900 leading-tight truncate'}>
                {(hasDetails ? item.item_name || item.content : item.content || item.item_name) || '内容未記入'}
              </p>
            </div>
            {item.price != null && (
              <span className={tx('text-sm', 'text-lg') + ` font-black shrink-0 ${item.prepaid ? 'text-gray-400' : 'text-red-600'}`}>
                ¥{item.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Row 3: 学校名 + 子供名 + 保護者名 + 受付日 + 依頼番号 */}
          <div className={tx('text-[10px]', 'text-sm') + ' flex items-center gap-1.5 mt-0.5'}>
            {item.child?.school_name && (
              <span className="font-black text-amber-600 truncate max-w-[7rem]">{item.child.school_name}</span>
            )}
            <span className={tx('text-xs', 'text-base') + ' font-bold text-gray-700 truncate flex-1'}>
              {item.child?.name ?? item.customer?.name ?? '（顧客不明）'}
              {item.child?.name && item.customer?.name && (
                <span className="text-gray-400 font-normal ml-1">({item.customer.name})</span>
              )}
            </span>
            <span className="text-gray-400 shrink-0">受付{fmtDate(item.received_date)}</span>
            <span className={tx('text-sm', 'text-xl') + ' font-black text-indigo-500 shrink-0 font-mono'}>{fmtReqNo('repair', item.request_no, item.id)}</span>
          </div>
        </div>
        <div className="shrink-0 self-center ml-1">
          {open
            ? <ChevronUp size={15} className="text-gray-300" />
            : <ChevronDown size={15} className="text-gray-300" />}
        </div>
      </button>
      <button onClick={() => setPrintOpen(true)} style={{ touchAction: 'manipulation' }}
        className="shrink-0 self-start mt-2.5 mr-2.5 p-1.5 rounded-lg text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all">
        <Printer size={16} />
      </button>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {/* 受付内容 — 学校・アイテム・作業・サイズ・聞いた項目をまとめて先に見せる。
              これが無いと、切れた content から作業内容を読み取るしかなかった */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.child?.school_name && (
                <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
              )}
              {item.garment_name && (
                <span className="text-xs font-black text-indigo-600 bg-white border border-indigo-100 px-1.5 py-0.5 rounded">{item.garment_name}</span>
              )}
              <span className="text-sm font-black text-gray-900">{item.item_name || item.content || '内容未記入'}</span>
            </div>

            {hasDetails ? (
              <div className="space-y-1 pt-0.5">
                {details.map((d, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="w-24 shrink-0 text-[11px] font-bold text-gray-400">{d.label}</span>
                    <span className="font-black text-gray-800 break-all">{d.value}</span>
                  </div>
                ))}
              </div>
            ) : item.content && item.content !== item.item_name ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
            ) : null}

            {/* 誰が受けて、誰が仕上げたか */}
            {(item.received_by_staff?.name || item.strung_by_staff?.name) && (
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs pt-1.5 border-t border-gray-200/70">
                {item.received_by_staff?.name && (
                  <span className="text-gray-500">受付 <span className="font-black text-gray-800">{item.received_by_staff.name}</span></span>
                )}
                {item.strung_by_staff?.name && (
                  <span className="text-gray-500">作業・完了 <span className="font-black text-gray-800">{item.strung_by_staff.name}</span></span>
                )}
              </div>
            )}
          </div>

          {/* Primary action button — 2-tap confirmation */}
          {primaryBtn && (
            <div>
              {confirmPrimary ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 space-y-3">
                  <p className="text-xs text-center text-gray-600 font-bold">
                    もう一度タップして確定します
                  </p>
                  <CompletionPhotoCapture photos={completionPhotos} onAdd={f => setCompletionPhotos(cp => [...cp, f])} onRemove={i => setCompletionPhotos(cp => cp.filter((_, j) => j !== i))} />
                  {/* 完了のときだけ担当者を必須にする（作業開始は不要） */}
                  {primaryBtn.label.includes('完了') && (
                    <StaffPicker storeId={storeId} label="作業・連絡した人（必須）" value={doneBy} onChange={setDoneBy} />
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmPrimary(false)}
                      className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold active:scale-95 transition-all">
                      戻る
                    </button>
                    <button onClick={async () => {
                      setConfirmPrimary(false)
                      if (completionPhotos.length > 0) { setLoading(true); await uploadCompletionPhotos(); setLoading(false) }
                      primaryBtn.onClick()
                    }} disabled={loading || (primaryBtn.label.includes('完了') && staffMissing)}
                      className={`flex-1 py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-all shadow-sm ${primaryBtn.color}`}>
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      確定する
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmPrimary(true)}
                  disabled={loading}
                  className={`w-full py-4 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : primaryBtn.label}
                </button>
              )}
            </div>
          )}

          {/* 構造化加工データ */}
          {item.repair_type === 'hem' && item.hem_length_mm !== null && item.hem_length_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1 mb-1.5">
              <span className="text-sm font-black text-amber-700">{item.hem_length_mm > 0 ? '+' : ''}{item.hem_length_mm}mm</span>
              <span className="text-[9px] text-amber-500">{item.hem_length_mm > 0 ? '長くする' : '短くする'}</span>
            </div>
          )}
          {item.repair_type === 'sleeve' && item.sleeve_adjust_mm !== null && item.sleeve_adjust_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1 mb-1.5">
              <span className="text-sm font-black text-blue-700">袖丈 {item.sleeve_adjust_mm > 0 ? '+' : ''}{item.sleeve_adjust_mm}mm</span>
            </div>
          )}
          {item.repair_type === 'waist' && item.waist_adjust_mm !== null && item.waist_adjust_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-xl px-2.5 py-1 mb-1.5">
              <span className="text-sm font-black text-purple-700">ウエスト {item.waist_adjust_mm > 0 ? '+' : ''}{item.waist_adjust_mm}mm</span>
            </div>
          )}
          {item.repair_type === 'embroidery' && item.embroidery_text && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl px-2.5 py-1.5 mb-1.5 inline-block">
              <p className="text-sm font-black text-pink-800">「{item.embroidery_text}」</p>
              <p className="text-[9px] text-pink-400">{[item.embroidery_color, item.embroidery_pos].filter(Boolean).join(' · ')}</p>
            </div>
          )}

          {/* 外注情報 */}
          {item.vendor_name && (
            <div className="flex items-center gap-2 flex-wrap">
              {item.sent_to_vendor_at && (
                <span className="text-[10px] text-gray-400">送付: {fmtDate(item.sent_to_vendor_at)}</span>
              )}
              {item.expected_return_date && (
                <span className={`text-[10px] font-bold ${new Date(item.expected_return_date) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                  戻り予定: {fmtDate(item.expected_return_date)}
                </span>
              )}
            </div>
          )}

          {/* 写真（受付時 + 完了時） */}
          {repairPhotos && repairPhotos.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">📸 写真</p>
              <div className="flex flex-wrap gap-2">
                {repairPhotos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 shrink-0">
                    <img src={p.url} alt="" className={`w-full h-full object-cover rounded-xl border-2 ${p.phase === 'after' ? 'border-emerald-400' : 'border-gray-200'}`} />
                    <span className={`absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5 rounded-b-xl font-bold ${p.phase === 'after' ? 'bg-emerald-600/80 text-white' : 'bg-black/40 text-white'}`}>
                      {p.phase === 'after' ? '完了時' : '受付時'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {item.internal_memo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-yellow-600 mb-0.5">スタッフメモ</p>
              <p className="text-xs text-gray-700">{item.internal_memo}</p>
            </div>
          )}
          {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
          <div className="flex items-center gap-3 flex-wrap">
            {item.customer?.tel && (
              <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                <Phone size={12} />{item.customer.tel}
              </a>
            )}
            <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 font-medium">
              <User size={11} />顧客詳細
            </a>
            <button onClick={() => setPrintOpen(true)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-bold">
              <Printer size={11} />印刷
            </button>
          </div>

          {/* 外注送付ボタン */}
          {item.vendor_name && !item.sent_to_vendor_at && (
            <button onClick={() => update(
              { sent_to_vendor_at: new Date().toISOString().slice(0, 10) },
              `${item.vendor_name}へ送付済みにしました`,
              { sent_to_vendor_at: null }
            )} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-orange-200 bg-orange-50 text-orange-700 flex items-center justify-center gap-2 hover:bg-orange-100 active:scale-95 transition-all">
              <Truck size={12} />📤 {item.vendor_name}へ送付済みにする
            </button>
          )}
          {item.vendor_name && item.sent_to_vendor_at && !item.work_started && (
            confirmInspect ? (
              <div className="rounded-2xl border-2 border-teal-300 bg-teal-50 px-4 py-3.5 space-y-2.5">
                <p className="text-sm text-center text-teal-800 font-black">📥 検品してください</p>
                <label className="flex items-center gap-2 bg-white rounded-xl border border-teal-200 px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={inspectOk} onChange={e => setInspectOk(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                  <span className="text-xs font-bold text-gray-700">仕上がり・汚れ・破損がないか確認しました</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setConfirmInspect(false); setInspectOk(false) }}
                    className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold active:scale-95 transition-all">
                    戻る
                  </button>
                  <button onClick={() => {
                    setConfirmInspect(false); setInspectOk(false)
                    update({ work_started: true, inspected_at: new Date().toISOString() }, '検品OK・作業再開しました', { work_started: false, inspected_at: null })
                  }} disabled={loading || !inspectOk}
                    className="flex-1 py-3 rounded-xl bg-teal-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition-all">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}検品OK・作業再開
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmInspect(true)} disabled={loading}
                className="w-full py-2.5 rounded-xl font-bold text-xs border border-teal-200 bg-teal-50 text-teal-700 flex items-center justify-center gap-2 hover:bg-teal-100 active:scale-95 transition-all">
                <Check size={12} />📥 外注品が戻ってきた（検品へ）
              </button>
            )
          )}

          {/* Payment toggle */}
          {item.prepaid ? (
            <button onClick={() => update({ prepaid: false }, '未払いに戻しました', { prepaid: true })}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Banknote size={14} />✅ 支払済み — タップで未払いに戻す
            </button>
          ) : confirmPay ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2.5">
              <p className="text-xs text-emerald-700 font-bold text-center">支払い完了にしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmPay(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={() => { update({ prepaid: true }, '支払い完了にしました'); setConfirmPay(false) }}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-1">
                  <Banknote size={13} />支払い完了
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmPay(true)}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 border-red-300 bg-red-50 text-red-600">
              <Banknote size={14} />⚠️ 未払い — タップして支払い確認
            </button>
          )}

          {/* ふだん押さない操作は小さく1行にまとめる（誤タップも減らす） */}
          {!confirmCancel && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {onEdit && (
                <button onClick={() => onEdit(item)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-gray-200 bg-white text-gray-600 flex items-center justify-center gap-1 hover:bg-gray-50 active:scale-95 transition-all">
                  <Pencil size={10} />内容変更
                </button>
              )}
              {item.status !== 'received' && (
                <button onClick={() => update(
                  { status: 'received', completed_date: null, delivered_date: null, notified: false },
                  '受付中に戻しました',
                  { status: item.status, completed_date: item.completed_date, delivered_date: item.delivered_date, notified: item.notified }
                )} disabled={loading}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-gray-200 bg-white text-gray-600 flex items-center justify-center gap-1 hover:bg-gray-50 active:scale-95 transition-all">
                  <RotateCcw size={10} />受付中に戻す
                </button>
              )}
              <button onClick={() => setConfirmCancel(true)}
                className="flex-1 py-2 rounded-lg text-[11px] font-bold border border-red-100 bg-white text-red-400 flex items-center justify-center gap-1 hover:bg-red-50 active:scale-95 transition-all">
                <Trash2 size={10} />削除
              </button>
            </div>
          )}

          {confirmCancel && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 space-y-2.5">
              <p className="text-sm text-red-700 font-black text-center">本当に削除しますか？</p>
              <p className="text-[10px] text-red-400 text-center">この操作は取り消せません</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading(true)
                  const { error } = await (supabase as any).from('repair_histories').delete().eq('id', item.id)
                  setLoading(false)
                  if (error) { onToast('err', '削除に失敗しました'); return }
                  onToast('ok', '削除しました')
                  onRefresh()
                }} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-black flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除する</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      </div>
      {printOpen && <RepairPrintModal items={[printableItem]} storeName={storeName} onClose={() => setPrintOpen(false)} />}
    </div>
  )
}

// ── 完了写真撮影サブコンポーネント ──────────────────────────────────────────
function CompletionPhotoCapture({
  photos,
  onAdd,
  onRemove,
}: {
  photos: { file: File; url: string }[]
  onAdd:  (p: { file: File; url: string }) => void
  onRemove: (i: number) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-gray-500">📸 完了写真（任意・価格参照・実績蓄積）</p>
      <div className="flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          <div key={i} className="relative w-14 h-14 shrink-0">
            <img src={p.url} alt="" className="w-full h-full object-cover rounded-xl border border-emerald-300" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow">
              <X size={10} />
            </button>
          </div>
        ))}
        <label className="w-14 h-14 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer active:bg-gray-50 shrink-0">
          <Camera size={16} className="text-gray-400" />
          <span className="text-[9px] text-gray-400 mt-0.5">撮影</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) onAdd({ file: f, url: URL.createObjectURL(f) })
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}

