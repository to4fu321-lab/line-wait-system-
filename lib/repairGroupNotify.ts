// ============================================================
//  複数点お直し受付の「出来上がり通知」グループ判定
//
//  1回の受付で登録した複数点（repair_group_id で束ねられた行）は、
//  group_notify_mode = 'combined' のとき、全点が完了するまで通知を
//  待ち、揃った時点で1通にまとめて送る。'individual'（既定）は
//  これまでどおり各行が完了するたびに個別に通知する。
// ============================================================

import { supabase } from '@/lib/supabase'

export interface GroupNotifyTarget {
  id: string
  garment_name: string | null
  item_name: string
  request_no: number | null
}

export interface GroupNotifyResolution {
  /** 今回まとめて通知すべきか（単独受付、または通知方式がindividualならtrue） */
  shouldNotify: boolean
  /** 通知に載せる品目名（まとめ通知なら全点を「、」区切りで連結） */
  itemNames: string
  /** 通知に載せる依頼番号（まとめ通知なら全点を「、」区切りで連結） */
  reqNos: string
  /** 通知後に notified=true を立てるべき行ID（まとめ通知ならグループ全行） */
  notifyTargetIds: string[]
  /** combinedモードでまだ他の点が完了しておらず、通知を待機している */
  waitingForGroup: boolean
}

/**
 * このお直し行を完了にした直後に呼ぶ。repair_group_id / group_notify_mode を見て、
 * 「今すぐ通知すべきか」「グループの他の点を待つべきか」を判定する。
 * 呼び出し元は先に対象行の status を 'completed' へ更新してから呼ぶこと
 * （このタイミングでグループ内の完了状況を再取得して判定するため）。
 */
export async function resolveGroupCompletionNotify(
  item: { id: string; item_name: string; garment_name?: string | null; request_no: number | null },
  repairGroupId: string | null | undefined,
  groupNotifyMode: 'individual' | 'combined' | null | undefined,
  fmtReqNo: (no: number | null, id: string) => string,
): Promise<GroupNotifyResolution> {
  const solo: GroupNotifyResolution = {
    shouldNotify: true,
    itemNames: `${item.garment_name ?? ''} ${item.item_name}`.trim(),
    reqNos: fmtReqNo(item.request_no, item.id),
    notifyTargetIds: [item.id],
    waitingForGroup: false,
  }
  if (!repairGroupId || groupNotifyMode !== 'combined') return solo

  const { data: siblings } = await (supabase as any)
    .from('repair_histories')
    .select('id, status, item_name, garment_name, request_no')
    .eq('repair_group_id', repairGroupId)
  if (!siblings || siblings.length <= 1) return solo

  const allDone = siblings.every((s: any) => s.id === item.id || ['completed', 'delivered'].includes(s.status))
  if (!allDone) {
    return { shouldNotify: false, itemNames: '', reqNos: '', notifyTargetIds: [], waitingForGroup: true }
  }
  return {
    shouldNotify: true,
    itemNames: siblings.map((s: any) => `${s.garment_name ?? ''} ${s.item_name}`.trim()).join('、'),
    reqNos: siblings.map((s: any) => fmtReqNo(s.request_no, s.id)).join('、'),
    notifyTargetIds: siblings.map((s: any) => s.id),
    waitingForGroup: false,
  }
}
