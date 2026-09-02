import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// 糸・部材マスタの追加フォームは銘柄・色・メーカーが全部手入力だった。
// タップ候補を追加したので、両カテゴリ（ガット/グリップ）に候補があること、
// 自由入力の input 自体は消していないことを確認する。
describe('糸・部材マスタのタップ候補', () => {
  const src = readFileSync(
    join(__dirname, '..', 'app/[storeId]/admin/master/materials/page.tsx'), 'utf8')

  it('メーカー・色の候補が string / grip 両方にある', () => {
    expect(src).toMatch(/MAKER_PRESETS[\s\S]*string:\s*\[[^\]]+\]/)
    expect(src).toMatch(/MAKER_PRESETS[\s\S]*grip:\s*\[[^\]]+\]/)
    expect(src).toMatch(/COLOR_PRESETS[\s\S]*string:\s*\[[^\]]+\]/)
    expect(src).toMatch(/COLOR_PRESETS[\s\S]*grip:\s*\[[^\]]+\]/)
  })

  it('銘柄はタップ候補があっても自由入力の input は残っている', () => {
    expect(src).toContain('knownBrands')
    expect(src).toContain('value={gName} onChange={e => setGName(e.target.value)}')
  })

  it('色・メーカーもタップ候補があっても自由入力の input は残っている', () => {
    expect(src).toContain('value={color} onChange={e => setColor(e.target.value)}')
    expect(src).toContain('value={maker} onChange={e => setMaker(e.target.value)}')
  })
})
