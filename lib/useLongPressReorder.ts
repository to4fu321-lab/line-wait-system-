'use client'

// ============================================================================
//  長押し → そのまま指を滑らせて並べ替える
//
//  受付マスタの種類/作業は sort_order 順に出るだけで、店側から並びを直す手段が
//  無かった（追加した順に後ろへ積まれ、よく使うものが末尾に埋もれる）。
//
//  HTML5 の drag&drop はスマホで動かないので Pointer Events で自前実装する。
//    ・押してすぐ動かした   → ページスクロール（長押し不成立）
//    ・押したまま HOLD_MS   → 並べ替え開始。以降 touchmove を止めて画面を固定
//    ・指を離す             → onDrop で確定（動いていなければ何もしない）
//
//  並べ替え中は draft（仮の並び）を返し、確定時だけ親に渡す。
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'

const HOLD_MS          = 350  // これだけ押したまま静止したら「掴んだ」
const CANCEL_PX        = 10   // 長押し成立前にこれ以上動いたらスクロール扱い
const SWAP_COOLDOWN_PX = 16   // 入れ替え直後の往復（ガタつき）防止
const CLICK_GUARD_MS   = 400  // ドラッグ直後に飛んでくる click を無視する時間

export interface Sortable { id: string; sort_order: number }

/** from 番目を to 番目へ移動した新しい配列を返す */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to) return list
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = list.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

/**
 * 並び順を 10 刻みで振り直し、値が変わる行だけ返す。
 * 10 刻みなのは、あとから手で1件だけ間に挿し込む余地を残すため。
 */
export function renumber<T extends Sortable>(list: T[]): { id: string; sort_order: number }[] {
  const out: { id: string; sort_order: number }[] = []
  list.forEach((x, i) => {
    const sort_order = (i + 1) * 10
    if (x.sort_order !== sort_order) out.push({ id: x.id, sort_order })
  })
  return out
}

export interface ReorderHandle {
  onPointerDown:   (e: React.PointerEvent) => void
  onPointerMove:   (e: React.PointerEvent) => void
  onPointerUp:     () => void
  onPointerCancel: () => void
  onContextMenu:   (e: React.MouseEvent) => void
}

export interface ReorderBind extends ReorderHandle {
  ref: (el: HTMLElement | null) => void
}

export function useLongPressReorder<T extends { id: string }>(
  list: T[],
  onDrop: (next: T[]) => void,
) {
  const [draft, setDraft]   = useState<T[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const els       = useRef(new Map<string, HTMLElement>())
  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPt   = useRef<{ x: number; y: number } | null>(null)
  const lastSwap  = useRef<{ x: number; y: number } | null>(null)
  const draftRef  = useRef<T[]>(list)
  const listRef   = useRef<T[]>(list)
  const droppedAt = useRef(0)

  listRef.current = list

  const clearTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  /** 指の位置に重なっているチップ/行の id */
  const hitTest = (x: number, y: number): string | null => {
    let found: string | null = null
    els.current.forEach((el, id) => {
      if (found) return
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) found = id
    })
    return found
  }

  const finish = useCallback(() => {
    const next   = draftRef.current
    const before = listRef.current
    setDragId(null)
    setDraft(null)
    lastSwap.current = null
    droppedAt.current = Date.now()
    if (next.length === before.length && next.some((x, i) => x.id !== before[i].id)) onDrop(next)
  }, [onDrop])

  useEffect(() => {
    if (!dragId) return

    const move = (e: PointerEvent) => {
      const over = hitTest(e.clientX, e.clientY)
      if (!over || over === dragId) return
      // 入れ替えると足元のレイアウトが動くので、少し動かすまで次の入れ替えを待つ
      const l = lastSwap.current
      if (l && Math.hypot(e.clientX - l.x, e.clientY - l.y) < SWAP_COOLDOWN_PX) return
      const cur  = draftRef.current
      const from = cur.findIndex(x => x.id === dragId)
      const to   = cur.findIndex(x => x.id === over)
      if (from < 0 || to < 0) return
      draftRef.current = moveItem(cur, from, to)
      setDraft(draftRef.current)
      lastSwap.current = { x: e.clientX, y: e.clientY }
    }
    const up = () => finish()
    // 並べ替え中はページを動かさない。passive:false でないと preventDefault が効かない
    const block = (e: TouchEvent) => e.preventDefault()

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    document.addEventListener('touchmove', block, { passive: false })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.removeEventListener('touchmove', block)
    }
  }, [dragId, finish])

  /** 落とし先の判定に使う要素（カード全体）を登録する */
  const bindTarget = useCallback((id: string) => ({
    ref: (el: HTMLElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id) },
  }), [])

  /** 掴む場所。カード全体を掴ませたくない時は見出し行だけに付ける */
  const bindHandle = useCallback((id: string): ReorderHandle => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const pt = { x: e.clientX, y: e.clientY }
      startPt.current = pt
      clearTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        draftRef.current = listRef.current
        lastSwap.current = pt
        setDraft(listRef.current)
        setDragId(id)
        navigator.vibrate?.(12)   // 「掴んだ」合図（対応端末のみ。iOS は undefined）
      }, HOLD_MS)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!timer.current || !startPt.current) return
      if (Math.hypot(e.clientX - startPt.current.x, e.clientY - startPt.current.y) > CANCEL_PX) clearTimer()
    },
    onPointerUp:     clearTimer,
    onPointerCancel: clearTimer,
    // Android の長押しメニュー / iOS のコピー吹き出しを抑える
    onContextMenu:   (e: React.MouseEvent) => e.preventDefault(),
  }), [clearTimer])

  /** 掴む場所＝落とし先が同じ（チップなど）の場合はこれ1つで足りる */
  const bind = useCallback(
    (id: string): ReorderBind => ({ ...bindTarget(id), ...bindHandle(id) }),
    [bindTarget, bindHandle],
  )

  /** 並べ替え直後の click（選択・編集・削除）を無視するか */
  const ignoreClick = useCallback(
    () => dragId != null || Date.now() - droppedAt.current < CLICK_GUARD_MS,
    [dragId],
  )

  return {
    /** 画面に出す並び（並べ替え中は仮の並び） */
    order: draft ?? list,
    dragId,
    dragging: dragId != null,
    bind,
    bindTarget,
    bindHandle,
    ignoreClick,
  }
}
