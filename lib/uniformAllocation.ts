import { supabase } from './supabase'

export interface ConflictItem {
  item_name: string
  size_label: string | null
  count: number
}

/**
 * 在校生・追加注文を入荷完了にしようとした際、
 * 同一アイテム×サイズで未引当の新入生注文があるかチェックする。
 * セット組対応：order_items を全件チェックするためセットでも自動対応。
 */
export async function checkNewStudentConflicts(
  orderId: string,
  storeId: string,
): Promise<ConflictItem[]> {
  // 対象注文のアイテムを取得
  const { data: items } = await (supabase as any)
    .from('uniform_order_items')
    .select('item_name, size_label')
    .eq('order_id', orderId)

  if (!items || items.length === 0) return []

  // 同ストアの新入生注文で未引当（arrived/delivered でない）ものを取得
  const { data: newStudentOrders } = await (supabase as any)
    .from('uniform_orders')
    .select('id')
    .eq('store_id', storeId)
    .eq('priority', 'new_student')
    .not('status', 'in', '("arrived","delivered")')

  if (!newStudentOrders || newStudentOrders.length === 0) return []

  const nsIds = (newStudentOrders as { id: string }[]).map(o => o.id)

  // 新入生注文のアイテムを取得
  const { data: nsItems } = await (supabase as any)
    .from('uniform_order_items')
    .select('item_name, size_label')
    .in('order_id', nsIds)

  if (!nsItems || nsItems.length === 0) return []

  // 自注文のアイテムと新入生アイテムの重複を抽出
  const conflicts: ConflictItem[] = []
  for (const myItem of items as { item_name: string; size_label: string | null }[]) {
    const matches = (nsItems as { item_name: string; size_label: string | null }[])
      .filter(ni =>
        ni.item_name === myItem.item_name &&
        (ni.size_label ?? '') === (myItem.size_label ?? '')
      )
    if (matches.length > 0) {
      const existing = conflicts.find(
        c => c.item_name === myItem.item_name && c.size_label === myItem.size_label
      )
      if (existing) existing.count += matches.length
      else conflicts.push({ item_name: myItem.item_name, size_label: myItem.size_label, count: matches.length })
    }
  }
  return conflicts
}
