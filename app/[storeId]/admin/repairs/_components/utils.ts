import type { DeliveryItem } from './types'
export { fmtDate, compressImage, todayJst } from '@/lib/adminUtils'

export function fmtReqNo(kind: 'repair' | 'purchase' | 'inquiry', no: number | null, id: string): string {
  const prefix = kind === 'repair' ? 'R' : kind === 'inquiry' ? 'I' : 'P'
  if (no != null) return `${prefix}-${String(no).padStart(4, '0')}`
  return `${prefix}-${id.replace(/-/g, '').substring(0, 4).toUpperCase()}`
}

export function rawToItem(row: Record<string, unknown>, kind: 'repair' | 'purchase'): DeliveryItem {
  return {
    id:             row.id as string,
    kind,
    store_id:       row.store_id as string,
    customer_id:    row.customer_id as string,
    child_id:       row.child_id as string | null,
    item_name:      row.item_name as string,
    sub_label:      kind === 'repair' ? (row.content as string ?? '') : (row.notes as string ?? ''),
    status:         row.status as string,
    prev_status:    kind === 'repair' ? 'completed' : 'arrived',
    received_date:  kind === 'repair' ? (row.received_date as string) : (row.ordered_date as string),
    ready_date:     kind === 'repair' ? (row.completed_date as string | null) : (row.arrived_date as string | null),
    desired_completion_date: kind === 'repair' ? (row.desired_completion_date as string | null ?? null) : null,
    delivered_date: row.delivered_date as string | null,
    price:          row.price as number | null,
    slip_number:    kind === 'repair' ? (row.slip_number as string | null) : null,
    request_no:     row.request_no as number | null ?? null,
    notified:       (row.notified as boolean) ?? false,
    payment_status: row.payment_status as string | null ?? null,
    delivered_by:   row.delivered_by as string | null ?? null,
    customer:       row.customer as { name: string; tel: string | null } | null,
    child:          row.child as { name: string; school_name: string | null } | null,
  }
}

export function getCatIcon(name: string): string {
  const n = name.replace(/[\s・]/g, '')
  if (/ジャケット|上着|ブレザー/.test(n)) return '🧥'
  if (/スラックス|ズボン|パンツ/.test(n)) return '👖'
  if (/スカート/.test(n)) return '👗'
  if (/ワイシャツ|シャツ|ブラウス/.test(n)) return '👔'
  if (/セーラー/.test(n)) return '👘'
  if (/詰め?襟|詰襟|学生服/.test(n)) return '🎓'
  if (/ベスト/.test(n)) return '🦺'
  if (/コート|マント/.test(n)) return '🧣'
  if (/体操|ジャージ/.test(n)) return '🏃'
  if (/刺繍|エンブレム/.test(n)) return '✨'
  if (/リボン|ネクタイ/.test(n)) return '🎀'
  return '✂️'
}

export function buildUniformMakerHierarchy(orders: import('./types').UniformOrderRow[]): import('./types').UniformMakerEntry[] {
  const makerMap = new Map<string, import('./types').UniformMakerEntry>()
  for (const order of orders) {
    const mk  = order.maker?.trim() || '（メーカー未設定）'
    const sch = order.child?.school_name ?? '（学校未設定）'
    if (!makerMap.has(mk)) makerMap.set(mk, { maker: mk, schools: [], totalCount: 0, allOrders: [] })
    const me = makerMap.get(mk)!
    me.allOrders.push(order)
    let se = me.schools.find(s => s.school_name === sch)
    if (!se) { se = { school_name: sch, items: [], totalCount: 0 }; me.schools.push(se) }
    for (const item of (order.items ?? [])) {
      const itm = item.item_name.trim()
      const sz  = item.size_label?.trim() ?? ''
      const qty = item.quantity ?? 1
      me.totalCount += qty
      se.totalCount += qty
      let ie = se.items.find(i => i.item_name === itm)
      if (!ie) { ie = { item_name: itm, sizes: [], totalCount: 0 }; se.items.push(ie) }
      ie.totalCount += qty
      let ze = ie.sizes.find(z => (z.size ?? '') === sz)
      if (!ze) { ze = { size: item.size_label, count: 0, orders: [] }; ie.sizes.push(ze) }
      ze.count += qty; if (!ze.orders.includes(order)) ze.orders.push(order)
    }
  }
  return Array.from(makerMap.values()).sort((a, b) => a.maker.localeCompare(b.maker, 'ja'))
}

export function buildMakerHierarchy(orders: import('./types').PurchaseRow[]): import('./types').MakerEntry[] {
  const makerMap = new Map<string, import('./types').MakerEntry>()
  for (const order of orders) {
    const mk  = order.maker?.trim()            || '（メーカー未設定）'
    const sch = order.child?.school_name       ?? '（学校未設定）'
    const itm = order.item_name.trim()
    const sz  = order.notes?.trim()            ?? ''
    if (!makerMap.has(mk)) makerMap.set(mk, { maker: mk, schools: [], totalCount: 0, allOrders: [] })
    const me = makerMap.get(mk)!
    me.totalCount++; me.allOrders.push(order)
    let se = me.schools.find(s => s.school_name === sch)
    if (!se) { se = { school_name: sch, items: [], totalCount: 0 }; me.schools.push(se) }
    se.totalCount++
    let ie = se.items.find(i => i.item_name === itm)
    if (!ie) { ie = { item_name: itm, sizes: [], totalCount: 0 }; se.items.push(ie) }
    ie.totalCount++
    let ze = ie.sizes.find(z => (z.size ?? '') === sz)
    if (!ze) { ze = { size: order.notes ?? null, count: 0, orders: [] }; ie.sizes.push(ze) }
    ze.count++; ze.orders.push(order)
  }
  return Array.from(makerMap.values()).sort((a, b) => a.maker.localeCompare(b.maker, 'ja'))
}
