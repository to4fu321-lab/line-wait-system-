import { describe, it, expect } from 'vitest'
import { normalizeSchoolName } from '@/lib/schoolDirectory'

// 学校名は店ごとに表記が揺れる（「桜ヶ丘中学校」「桜ケ丘 中学校」「桜ヶ丘中」…）。
// 候補の重複判定に使うキーは、この揺れを吸収できないと同じ学校が何度も並ぶ。
describe('normalizeSchoolName', () => {
  it('空白（半角・全角）を無視する', () => {
    expect(normalizeSchoolName('桜ヶ丘 中学校')).toBe(normalizeSchoolName('桜ヶ丘中学校'))
    expect(normalizeSchoolName('桜ヶ丘　中学校')).toBe(normalizeSchoolName('桜ヶ丘中学校'))
  })

  it('中黒・読点・ハイフンを無視する', () => {
    expect(normalizeSchoolName('市立・桜ヶ丘中学校')).toBe(normalizeSchoolName('市立桜ヶ丘中学校'))
    expect(normalizeSchoolName('第一-中学校')).toBe(normalizeSchoolName('第一中学校'))
    expect(normalizeSchoolName('第一ー中学校')).toBe(normalizeSchoolName('第一中学校'))
  })

  it('全角英数を半角に揃える', () => {
    expect(normalizeSchoolName('ＡＢＣ学園')).toBe(normalizeSchoolName('ABC学園'))
    expect(normalizeSchoolName('第１中学校')).toBe(normalizeSchoolName('第1中学校'))
  })

  it('英字の大小を無視する', () => {
    expect(normalizeSchoolName('abc学園')).toBe(normalizeSchoolName('ABC学園'))
  })

  it('別の学校は別のキーになる（畳みすぎない）', () => {
    expect(normalizeSchoolName('桜ヶ丘中学校')).not.toBe(normalizeSchoolName('桜ヶ丘高等学校'))
    expect(normalizeSchoolName('第一中学校')).not.toBe(normalizeSchoolName('第二中学校'))
  })

  it('空文字でも落ちない', () => {
    expect(normalizeSchoolName('')).toBe('')
    expect(normalizeSchoolName('　 ')).toBe('')
  })
})
