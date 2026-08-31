import { describe, it, expect } from 'vitest'
import { moveItem, renumber } from '@/lib/useLongPressReorder'

const ids = (l: { id: string }[]) => l.map(x => x.id)

describe('moveItem（並べ替え）', () => {
  const l = ['a', 'b', 'c', 'd']

  it('後ろへ動かす', () => expect(moveItem(l, 0, 2)).toEqual(['b', 'c', 'a', 'd']))
  it('前へ動かす',   () => expect(moveItem(l, 3, 1)).toEqual(['a', 'd', 'b', 'c']))
  it('末尾へ動かす', () => expect(moveItem(l, 0, 3)).toEqual(['b', 'c', 'd', 'a']))

  it('同じ位置なら元の配列をそのまま返す（無駄な再描画・保存をしない）', () => {
    expect(moveItem(l, 2, 2)).toBe(l)
  })

  it('範囲外は何もしない', () => {
    expect(moveItem(l, -1, 2)).toBe(l)
    expect(moveItem(l, 0, 9)).toBe(l)
  })

  it('元の配列を壊さない', () => {
    const src = [...l]
    moveItem(src, 0, 3)
    expect(src).toEqual(l)
  })
})

describe('renumber（sort_order の振り直し）', () => {
  it('10刻みに振り直し、値が変わる行だけ返す', () => {
    // b と a を入れ替えた状態。b は既に 10 なので更新不要
    const next = [
      { id: 'b', sort_order: 10 },
      { id: 'a', sort_order: 10 },
      { id: 'c', sort_order: 30 },
    ]
    expect(renumber(next)).toEqual([{ id: 'a', sort_order: 20 }])
  })

  it('並びが変わっていなければ更新は0件（指を離しただけでDBを叩かない）', () => {
    const same = [
      { id: 'a', sort_order: 10 },
      { id: 'b', sort_order: 20 },
    ]
    expect(renumber(same)).toEqual([])
  })

  it('プリセット取り込み直後のバラバラな値も 10,20,30… に揃う', () => {
    const messy = [
      { id: 'a', sort_order: 100 },
      { id: 'b', sort_order: 100 },
      { id: 'c', sort_order: 0 },
    ]
    expect(renumber(messy)).toEqual([
      { id: 'a', sort_order: 10 },
      { id: 'b', sort_order: 20 },
      { id: 'c', sort_order: 30 },
    ])
  })

  it('間に1件挿し込む余地が残る（連番ではなく10刻み）', () => {
    const out = renumber([{ id: 'a', sort_order: 0 }, { id: 'b', sort_order: 0 }])
    expect(out[1].sort_order - out[0].sort_order).toBeGreaterThan(1)
  })
})

describe('並べ替え → 保存 の一連の流れ', () => {
  it('末尾のよく使う種類を先頭へ持ってくると、その順で保存される', () => {
    const garments = [
      { id: 'slacks',  sort_order: 10 },
      { id: 'skirt',   sort_order: 20 },
      { id: 'badminton', sort_order: 30 },
    ]
    const next = moveItem(garments, 2, 0)
    expect(ids(next)).toEqual(['badminton', 'slacks', 'skirt'])
    expect(renumber(next)).toEqual([
      { id: 'badminton', sort_order: 10 },
      { id: 'slacks',    sort_order: 20 },
      { id: 'skirt',     sort_order: 30 },
    ])
  })
})
