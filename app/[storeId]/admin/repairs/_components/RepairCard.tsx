'use client'

import { useState } from 'react'
import {
  Loader2, ChevronDown, ChevronUp,
  Phone, User, Check, RotateCcw,
  Banknote, Pencil, Truck, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS,
  REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS, REPAIR_TYPE_COLORS,
} from '@/types/crm'
import type { RequestType } from '@/types/crm'
import { fmtDate, fmtReqNo } from './utils'
import type { RepairRow } from './types'

export function RepairCard({ item, storeId, onRefresh, onToast, onEdit, selected, onToggle, isSimpleMode = false }: {
  item: RepairRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: RepairRow) => void
  selected?: boolean
  onToggle?: () => void
  isSimpleMode?: boolean
}) {
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [confirmPrimary, setConfirmPrimary] = useState(false)
  const [confirmPay,    setConfirmPay]    = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const reqType = (item.request_type ?? 'repair') as RequestType
  const name    = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deadlineDate = item.desired_completion_date ? new Date(item.desired_completion_date) : null
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0)
  const daysLeft   = deadlineDate ? Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000) : null
  const isOverdue  = daysLeft !== null && daysLeft < 0
  const isDueSoon  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1

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

  // Primary action config
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (reqType === 'repair') {
    if (!item.work_started) {
      primaryBtn = {
        label: '✂️ 作業開始',
        color: 'bg-amber-500 hover:bg-amber-400 shadow-amber-200',
        onClick: () => update({ work_started: true }, '作業開始しました', { work_started: false }),
      }
    } else {
      primaryBtn = {
        label: '✅ お直し完了',
        color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
        onClick: () => update(
          { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
          'お直し完了・連絡しました',
          { status: 'received', completed_date: null, notified: false }
        ),
      }
    }
  } else if (reqType === 'walk_in') {
    primaryBtn = {
      label: '✅ 対応完了・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'hold_request') {
    primaryBtn = {
      label: '✅ 確保済み・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '確保済みにしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'inquiry') {
    primaryBtn = {
      label: '✅ 問合せ対応完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '問合せ対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'repair_consult') {
    primaryBtn = {
      label: '✅ 相談完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '相談完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'payment_pending') {
    primaryBtn = {
      label: '✅ 入金確認・回収完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '入金確認・回収完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  }

  const cardBg =
    isOverdue  ? 'bg-red-50 border-2 border-red-400' :
    isDueSoon  ? 'bg-amber-50 border-2 border-amber-400' :
    item.work_started ? 'bg-amber-50/50 border border-amber-200' :
    'bg-white border border-gray-200'

  // ── シンプルモード ───────────────────────────────────────────────
  if (isSimpleMode) {
    const reqNo = fmtReqNo('repair', item.request_no, item.id)

    async function handleSimpleComplete() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)
      const { error } = await (supabase as any).from('repair_histories')
        .update({ status: 'completed', completed_date: today, work_started: true, notified: true, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (error) { setLoading(false); onToast('err', '更新に失敗しました'); return }
      fetch('/api/notify-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repairId: item.id }),
      }).catch(() => {})
      setLoading(false)
      onRefresh()
      onToast('ok', '✅ お直し完了・LINEで通知しました')
    }

    async function handleSimpleRevert() {
      setLoading(true)
      const { error } = await (supabase as any).from('repair_histories')
        .update({ status: 'received', work_started: false, completed_date: null, notified: false, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      setLoading(false)
      if (error) { onToast('err', '更新に失敗しました'); return }
      onRefresh()
      onToast('ok', '受付中に戻しました')
    }

    return (
      <div className={`rounded-2xl overflow-hidden shadow-sm ${
        isOverdue ? 'border-2 border-red-400' : isDueSoon ? 'border-2 border-amber-400' : 'border border-gray-200'
      } bg-white`}>
        {/* 受付番号ヘッダー */}
        <div className={`px-4 py-2.5 flex items-center justify-between ${isOverdue ? 'bg-red-600' : 'bg-indigo-600'}`}>
          <span className="text-indigo-200 text-xs font-bold">受付番号</span>
          <span className="text-white text-2xl font-black font-mono tracking-wider">{reqNo}</span>
        </div>

        <div className="p-4 space-y-3">
          {/* お客様情報（大きく） */}
          <div>
            {item.child?.school_name && (
              <p className="text-base font-black text-amber-600 leading-tight">{item.child.school_name}</p>
            )}
            <p className="text-2xl font-black text-gray-900 leading-tight">{name}</p>
            {item.child?.name && item.customer?.name && (
              <p className="text-sm text-gray-400 font-medium mt-0.5">保護者: {item.customer.name}</p>
            )}
          </div>

          {/* アイテム・内容（大きく） */}
          <div className="bg-gray-50 rounded-2xl px-4 py-3 space-y-1">
            {item.item_name && item.content && item.item_name !== item.content && (
              <p className="text-sm text-gray-500 font-bold">{item.item_name}</p>
            )}
            <p className="text-lg font-black text-gray-900 leading-snug">
              {item.content || item.item_name || '内容未記入'}
            </p>
            {item.repair_type === 'hem' && item.hem_length_mm != null && item.hem_length_mm !== 0 && (
              <p className="text-base font-black text-amber-700">裾上げ {item.hem_length_mm > 0 ? '+' : ''}{item.hem_length_mm}mm</p>
            )}
            {item.repair_type === 'sleeve' && item.sleeve_adjust_mm != null && item.sleeve_adjust_mm !== 0 && (
              <p className="text-base font-black text-blue-700">袖丈 {item.sleeve_adjust_mm > 0 ? '+' : ''}{item.sleeve_adjust_mm}mm</p>
            )}
            {item.repair_type === 'waist' && item.waist_adjust_mm != null && item.waist_adjust_mm !== 0 && (
              <p className="text-base font-black text-purple-700">ウエスト {item.waist_adjust_mm > 0 ? '+' : ''}{item.waist_adjust_mm}mm</p>
            )}
            {item.repair_type === 'embroidery' && item.embroidery_text && (
              <p className="text-base font-black text-pink-700">刺繍「{item.embroidery_text}」{item.embroidery_color} {item.embroidery_pos}</p>
            )}
          </div>

          {/* 金額・期限 */}
          <div className="flex items-center gap-3 flex-wrap">
            {item.price != null && (
              <span className={`text-lg font-black ${item.prepaid ? 'text-gray-500' : 'text-red-600'}`}>
                ¥{item.price.toLocaleString()}{!item.prepaid && ' ⚠️未払い'}
              </span>
            )}
            {item.desired_completion_date && (
              <span className={`text-sm font-black ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
                {isOverdue ? '🚨' : isDueSoon ? '⚠️' : ''}希望日 {new Date(item.desired_completion_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
              </span>
            )}
            <span className="text-xs text-gray-400">受付 {fmtDate(item.received_date)}</span>
          </div>

          {/* メインアクション */}
          {confirmPrimary ? (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-4 space-y-3">
              <p className="text-base text-center text-emerald-800 font-black">LINEで通知して完了にしますか？</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPrimary(false)}
                  className="flex-1 py-4 rounded-2xl bg-white border-2 border-gray-200 text-gray-600 text-base font-black active:scale-95 transition-all"
                  style={{ touchAction: 'manipulation' }}>
                  戻る
                </button>
                <button onClick={() => { setConfirmPrimary(false); handleSimpleComplete() }} disabled={loading}
                  className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white text-base font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md disabled:opacity-50"
                  style={{ touchAction: 'manipulation' }}>
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}完了・通知する
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmPrimary(true)} disabled={loading}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-lg rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
              {loading ? <Loader2 size={22} className="animate-spin" /> : '✅'}
              お直し完了・LINE通知する
            </button>
          )}

          {/* 戻すボタン */}
          <button onClick={handleSimpleRevert} disabled={loading}
            style={{ touchAction: 'manipulation' }}
            className="w-full py-3.5 border-2 border-gray-200 bg-white text-gray-500 font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <RotateCcw size={15} />受付中に戻す
          </button>

          {/* 電話 */}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`}
              className="flex items-center justify-center gap-2 py-3 text-indigo-600 font-bold text-base">
              <Phone size={16} />{item.customer.tel}
            </a>
          )}
        </div>
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
      {/* Clickable summary area */}
      <button className="w-full text-left px-3 pt-2 pb-2 flex items-start gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          {/* Row 1: badges + deadline */}
          <div className="flex items-center gap-1 mb-0.5">
            <span className={`text-[9px] px-1.5 py-0 rounded-full border font-bold leading-5 ${REQUEST_TYPE_COLORS[reqType]}`}>
              {REQUEST_TYPE_LABELS[reqType]}
            </span>
            {item.repair_type && (
              <span className={`text-[9px] px-1.5 py-0 rounded-full border font-bold leading-5 ${REPAIR_TYPE_COLORS[item.repair_type]}`}>
                {REPAIR_TYPE_ICONS[item.repair_type]} {REPAIR_TYPE_LABELS[item.repair_type]}
              </span>
            )}
            {item.sent_to_vendor_at ? (
              <span className="text-[9px] px-1.5 py-0 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-bold leading-5">🏭外注中</span>
            ) : item.vendor_name ? (
              <span className="text-[9px] px-1.5 py-0 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold leading-5 max-w-[6rem] truncate">📤{item.vendor_name}</span>
            ) : null}
            {item.is_rework && <span className="text-[9px] px-1.5 py-0 rounded-full bg-red-100 text-red-700 border border-red-200 font-bold leading-5">再加工</span>}
            {isOverdue && <span className="text-[9px] px-1.5 py-0 rounded-full bg-red-600 text-white font-black leading-5 animate-pulse">🚨{Math.abs(daysLeft!)}日超過</span>}
            {isDueSoon && !isOverdue && <span className="text-[9px] px-1.5 py-0 rounded-full bg-amber-500 text-white font-black leading-5">⚠️期限間近</span>}
            {!item.prepaid && <span className="text-[9px] px-1.5 py-0 rounded-full bg-red-600 text-white font-black leading-5 animate-pulse">未払い</span>}
            <span className="flex-1" />
            {item.desired_completion_date && (
              <span className={`text-[9px] font-bold shrink-0 ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                希望{fmtDate(item.desired_completion_date)}
              </span>
            )}
          </div>

          {/* Row 2: アイテム名 + 内容 + 金額 */}
          <div className="flex items-start gap-1.5">
            <div className="flex-1 min-w-0">
              {item.item_name && item.content && item.item_name !== item.content && (
                <p className="text-[10px] text-gray-400 truncate leading-none mb-0.5">{item.item_name}</p>
              )}
              <p className="text-sm font-black text-gray-900 leading-tight truncate">
                {item.content || item.item_name || '内容未記入'}
              </p>
            </div>
            {item.price != null && (
              <span className={`text-sm font-black shrink-0 ${item.prepaid ? 'text-gray-400' : 'text-red-600'}`}>
                ¥{item.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Row 3: 学校名 + 子供名 + 保護者名 + 受付日 + 依頼番号 */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {item.child?.school_name && (
              <span className="text-[10px] font-black text-amber-600 truncate max-w-[7rem]">{item.child.school_name}</span>
            )}
            <span className="text-xs font-bold text-gray-700 truncate flex-1">
              {item.child?.name ?? item.customer?.name ?? '（顧客不明）'}
              {item.child?.name && item.customer?.name && (
                <span className="text-[10px] text-gray-400 font-normal ml-1">({item.customer.name})</span>
              )}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">受付{fmtDate(item.received_date)}</span>
            <span className="text-[10px] font-black text-indigo-400 shrink-0 font-mono">{fmtReqNo('repair', item.request_no, item.id)}</span>
          </div>
        </div>
        <div className="shrink-0 self-center ml-1">
          {open
            ? <ChevronUp size={15} className="text-gray-300" />
            : <ChevronDown size={15} className="text-gray-300" />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {/* Primary action button — 2-tap confirmation */}
          {primaryBtn && (
            <div>
              {confirmPrimary ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 space-y-3">
                  <p className="text-xs text-center text-gray-600 font-bold">
                    もう一度タップして確定します
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmPrimary(false)}
                      className="flex-1 py-3 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-bold active:scale-95 transition-all">
                      戻る
                    </button>
                    <button onClick={() => { setConfirmPrimary(false); primaryBtn.onClick() }} disabled={loading}
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
            <button onClick={() => update(
              { work_started: true, sent_to_vendor_at: item.sent_to_vendor_at },
              '外注品が戻りました',
              { work_started: false }
            )} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-teal-200 bg-teal-50 text-teal-700 flex items-center justify-center gap-2 hover:bg-teal-100 active:scale-95 transition-all">
              <Check size={12} />📥 外注品が戻ってきた（検品へ）
            </button>
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

          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
              <Pencil size={11} />注文内容を変更する
            </button>
          )}

          {item.status !== 'received' && (
            <button onClick={() => update(
              { status: 'received', completed_date: null, delivered_date: null, notified: false },
              '受付中に戻しました',
              { status: item.status, completed_date: item.completed_date, delivered_date: item.delivered_date, notified: item.notified }
            )} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 active:scale-95 transition-all">
              <RotateCcw size={11} />受付中に戻す
            </button>
          )}

          {/* Cancel / delete */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)}
              className="w-full py-2.5 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={11} />キャンセル（削除）
            </button>
          ) : (
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
    </div>
  )
}
