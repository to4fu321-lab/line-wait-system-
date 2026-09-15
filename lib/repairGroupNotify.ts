// ============================================================
//  複数点・複数加工のお直し受付の「出来上がり通知」判定
//
//  粒度は2段階:
//   - physical_item_id : 同じ物理的な1点（例: スラックス1本）にかける
//     複数加工。これは必ず全部終わってから1通で通知する（分割不可）。
//   - repair_group_id   : 同じ受付セッションで登録した複数の物理アイテム
//     （別の商品も含む）。既定は個別通知だが、ある物理アイテムが完了した
//     時点で同じセッションに未完了の別アイテムが残っていれば、スタッフに
//     「まとめて通知するか」を確認する（confirmBundleNotify → 承諾したら
//     group_notify_mode を 'combined' に切り替え、グループ全体が揃うまで待つ）。
// ============================================================

import { supabase } from '@/lib/supabase'

export interface NotifyRow {
  id: string
  status: string
  item_name: string
  garment_name: string | null
  request_no: number | null
}

export interface OpenPhysicalItem {
  physicalItemId: string | null
  rows: NotifyRow[]
  label: string
}

function joinNames(rows: { garment_name: string | null; item_name: string }[]): string {
  const garmentName = rows[0]?.garment_name ?? ''
  const processes = rows.map(r => r.item_name).join('＋')
  return `${garmentName} ${processes}`.trim()
}

function joinReqNos(rows: NotifyRow[], fmtReqNo: (no: number | null, id: string) => string): string {
  return rows.map(r => fmtReqNo(r.request_no, r.id)).join('、')
}

/** この行が属する物理アイテム（同じ garment 1点にかける複数加工）の全行を取得する */
export async function fetchPhysicalItemRows(physicalItemId: string): Promise<NotifyRow[]> {
  const { data } = await (supabase as any)
    .from('repair_histories')
    .select('id, status, item_name, garment_name, request_no')
    .eq('physical_item_id', physicalItemId)
  return data ?? []
}

/** 同じ受付セッション（repair_group_id）内で、指定の物理アイテム以外にまだ完了していない物理アイテムを探す */
export async function findOtherOpenPhysicalItems(
  repairGroupId: string, excludePhysicalItemId: string | null,
): Promise<OpenPhysicalItem[]> {
  const { data } = await (supabase as any)
    .from('repair_histories')
    .select('id, status, item_name, garment_name, request_no, physical_item_id')
    .eq('repair_group_id', repairGroupId)
  const rows = (data ?? []) as (NotifyRow & { physical_item_id: string | null })[]
  const groups = new Map<string, (NotifyRow & { physical_item_id: string | null })[]>()
  for (const r of rows) {
    const key = r.physical_item_id ?? r.id
    if (r.physical_item_id != null && r.physical_item_id === excludePhysicalItemId) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  // まだ全加工が終わっていない（＝これから完了するのを待てる）物理アイテムだけを対象にする
  const open: OpenPhysicalItem[] = []
  for (const groupRows of Array.from(groups.values())) {
    const allDone = groupRows.every((r: NotifyRow) => ['completed', 'delivered'].includes(r.status))
    if (allDone) continue
    open.push({ physicalItemId: groupRows[0].physical_item_id, rows: groupRows, label: joinNames(groupRows) })
  }
  return open
}

export async function setGroupNotifyMode(repairGroupId: string, mode: 'individual' | 'combined'): Promise<void> {
  await (supabase as any).from('repair_histories').update({ group_notify_mode: mode }).eq('repair_group_id', repairGroupId)
}

export interface GroupNotifyResolution {
  shouldNotify: boolean
  itemNames: string
  reqNos: string
  notifyTargetIds: string[]
  waitingForGroup: boolean
}

/**
 * 物理アイテム単位で完了通知の対象・文面を決める（repair_group_id が combined の場合のみ、
 * グループ全体が揃うまで待つ）。物理アイテム自体はこの時点で全行 completed/delivered 済み。
 */
export async function resolveGroupCompletionNotify(
  physicalItemRows: NotifyRow[],
  repairGroupId: string | null | undefined,
  groupNotifyMode: 'individual' | 'combined' | null | undefined,
  fmtReqNo: (no: number | null, id: string) => string,
): Promise<GroupNotifyResolution> {
  const solo: GroupNotifyResolution = {
    shouldNotify: true,
    itemNames: joinNames(physicalItemRows),
    reqNos: joinReqNos(physicalItemRows, fmtReqNo),
    notifyTargetIds: physicalItemRows.map(r => r.id),
    waitingForGroup: false,
  }
  if (!repairGroupId || groupNotifyMode !== 'combined') return solo

  const { data: siblings } = await (supabase as any)
    .from('repair_histories')
    .select('id, status, item_name, garment_name, request_no')
    .eq('repair_group_id', repairGroupId)
  if (!siblings || siblings.length <= physicalItemRows.length) return solo

  const allDone = (siblings as NotifyRow[]).every(s => ['completed', 'delivered'].includes(s.status))
  if (!allDone) {
    return { shouldNotify: false, itemNames: '', reqNos: '', notifyTargetIds: [], waitingForGroup: true }
  }
  return {
    shouldNotify: true,
    itemNames: joinNames(siblings as NotifyRow[]),
    reqNos: joinReqNos(siblings as NotifyRow[], fmtReqNo),
    notifyTargetIds: (siblings as NotifyRow[]).map(s => s.id),
    waitingForGroup: false,
  }
}
