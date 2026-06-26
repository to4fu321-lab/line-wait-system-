'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { rawToItem } from '../../repairs/_components/utils'
import type { RepairRow, PurchaseRow, UniformOrderRow, DeliveryItem } from '../../repairs/_components/types'
import type { InquiryRow } from '../../_components/InquiryModal'
import {
  type Task, type Bucket, bucketFromDeadline, ageDays, hoursLabel,
} from './task'

const sb = supabase as any

function clip(s: string | null | undefined, n = 40): string {
  const t = (s ?? '').trim()
  return t.length > n ? t.slice(0, n) + '…' : t
}
function childOrCust(row: { child?: { name: string; school_name: string | null } | null; customer?: { name: string } | null }): { name: string; school: string | null } {
  return { name: row.child?.name ?? row.customer?.name ?? '（お客様）', school: row.child?.school_name ?? null }
}

export function useTodayTasks(storeId: string) {
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [alertDays, setAlertDays] = useState(7)

  useEffect(() => {
    if (!storeId) return
    sb.from('stores').select('alert_days_repair').eq('id', storeId).single()
      .then(({ data }: { data: { alert_days_repair: number } | null }) => {
        if (data?.alert_days_repair) setAlertDays(data.alert_days_repair)
      })
  }, [storeId])

  const refetch = useCallback(async () => {
    if (!storeId) return
    setLoading(true); setError(null)
    const [
      { data: repairData, error: repErr },
      { data: purchaseData },
      { data: waitRepairs },
      { data: waitPurchases },
      { data: uniformData },
      { data: inquiryData },
    ] = await Promise.all([
      sb.from('repair_histories')
        .select('*, desired_completion_date, work_started, customer:customers(id,name,tel,line_user_id), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'received').order('received_date', { ascending: true }),
      sb.from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).not('status', 'in', '("arrived","delivered")').order('ordered_date', { ascending: true }),
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed').order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived').order('arrived_date', { ascending: true }),
      sb.from('uniform_orders')
        .select('id,store_id,customer_id,child_id,maker,priority,status,payment_status,total_amount,notes,expected_delivery_date,created_at,updated_at,customer:customers(id,name,tel),child:children(name,school_name),items:uniform_order_items(item_name,size_label,quantity,unit_price)')
        .eq('store_id', storeId).eq('status', 'confirmed').order('created_at', { ascending: true }),
      sb.from('inquiries')
        .select('id,request_no,customer_name,customer_id,content,type,is_urgent,due_date,status,response_method,response_notes,responded_at,received_by,handled_by,created_at')
        .eq('store_id', storeId).in('status', ['pending', 'in_progress']).order('created_at', { ascending: true }),
    ])
    if (repErr) setError(repErr.message)

    const out: Task[] = []

    // ── お直し（received）──
    for (const r of (repairData ?? []) as RepairRow[]) {
      const who = childOrCust(r)
      if (r.request_type === 'repair') {
        if (!r.work_started && r.sent_to_vendor_at) continue // 外注待ちは対象外
        const start = !r.work_started
        const b = bucketFromDeadline(r.desired_completion_date, 'week')
        out.push({
          id: `${start ? 'repair_start' : 'repair_complete'}:${r.id}`, rowId: r.id,
          kind: start ? 'repair_start' : 'repair_complete',
          name: who.name, schoolName: who.school,
          itemLabel: clip(r.content || r.item_name),
          actionLabel: start ? '作業開始' : 'お直し完了',
          bucket: b.bucket, deadlineLabel: b.label, sortKey: b.sortKey,
          source: { type: 'repair', row: r },
        })
      } else {
        const b = bucketFromDeadline(r.desired_completion_date, 'week')
        out.push({
          id: `repair_other:${r.id}`, rowId: r.id, kind: 'repair_other',
          name: who.name, schoolName: who.school, itemLabel: clip(r.content || r.item_name),
          actionLabel: '対応完了', bucket: b.bucket, deadlineLabel: b.label, sortKey: b.sortKey,
          source: { type: 'repair', row: r },
        })
      }
    }

    // ── 発注 / 入荷 ──
    for (const p of (purchaseData ?? []) as PurchaseRow[]) {
      const who = childOrCust(p)
      const isArrival = p.status === 'on_order' || p.status === 'stocked'
      out.push({
        id: `${isArrival ? 'arrival' : 'purchase_order'}:${p.id}`, rowId: p.id,
        kind: isArrival ? 'arrival' : 'purchase_order',
        name: who.name, schoolName: who.school,
        itemLabel: clip([p.item_name, p.maker].filter(Boolean).join(' / ')),
        actionLabel: isArrival ? '入荷完了' : '発注確認する',
        bucket: isArrival ? 'week' : 'today', deadlineLabel: null, sortKey: isArrival ? 600 : 300,
        source: { type: 'purchase', row: p },
      })
    }

    // ── 制服注文（confirmed）──
    for (const u of (uniformData ?? []) as UniformOrderRow[]) {
      const who = childOrCust(u)
      const cnt = u.items?.length ?? 0
      out.push({
        id: `uniform_order:${u.id}`, rowId: u.id, kind: 'uniform_order',
        name: who.name, schoolName: who.school,
        itemLabel: clip(`${u.maker ?? '制服'}${cnt ? ` ${cnt}点` : ''}`),
        actionLabel: '発注確認する', bucket: 'today', deadlineLabel: null, sortKey: 320,
        source: { type: 'uniform', row: u },
      })
    }

    // ── お渡し待ち（completed修理 + arrived発注）──
    const waiting: DeliveryItem[] = [
      ...((waitRepairs ?? []) as Record<string, unknown>[]).map((r) => rawToItem(r, 'repair')),
      ...((waitPurchases ?? []) as Record<string, unknown>[]).map((p) => rawToItem(p, 'purchase')),
    ]
    for (const d of waiting) {
      const age = ageDays(d.ready_date) ?? 0
      const aged = age > alertDays
      out.push({
        id: `delivery:${d.kind}:${d.id}`, rowId: d.id, kind: 'delivery',
        name: d.child?.name ?? d.customer?.name ?? '（お客様）',
        schoolName: d.child?.school_name ?? null,
        itemLabel: clip(d.item_name || d.sub_label),
        actionLabel: '準備完了',
        bucket: aged ? 'now' : 'today',
        deadlineLabel: aged ? `お預かり${age}日` : null,
        sortKey: aged ? -500 - age : 200,
        source: { type: 'delivery', row: d },
      })
    }

    // ── 問合せ（pending / in_progress）──
    for (const q of (inquiryData ?? []) as InquiryRow[]) {
      const pending = q.status === 'pending'
      let bucket: Bucket = 'today'; let label: string | null = null; let sortKey = 100
      if (q.is_urgent) { bucket = 'now'; label = '急ぎ'; sortKey = -2000 }
      else {
        const b = bucketFromDeadline(q.due_date, 'today')
        bucket = b.bucket; label = hoursLabel(q.due_date) ?? b.label; sortKey = b.sortKey - 1
      }
      out.push({
        id: `inquiry:${q.id}`, rowId: q.id, kind: 'inquiry',
        name: q.customer_name ?? '（お客様）', schoolName: null,
        itemLabel: clip(q.content),
        actionLabel: pending ? '対応する' : '完了にする',
        bucket, deadlineLabel: label, sortKey,
        source: { type: 'inquiry', row: q },
      })
    }

    out.sort((a, b) => a.sortKey - b.sortKey)
    setTasks(out)
    setLoading(false)
  }, [storeId, alertDays])

  useEffect(() => { refetch() }, [refetch])

  return { tasks, remaining: tasks.length, loading, error, refetch }
}
