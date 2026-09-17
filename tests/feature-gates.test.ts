import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { FeatureKey } from '@/lib/features'
import { RETIRED_FEATURE_KEYS } from '@/lib/features'
import { FEATURE_KEYS_IN_CATALOG } from '@/lib/featureCatalog'

// ============================================================================
//  スーパー管理画面のトグルと、実際の画面の対応チェック
//
//  「順番待ちタブOFFなのに順番待ちQR POPが作れる」のように、トグルはあるのに
//  どこもそれを見ていない＝切っても切れない機能があった。ここでは
//  「super-admin に並ぶ全トグルが、アプリのどこかで実際に読まれている」ことを
//  機械的に確認する。UNWIRED は未実装として明示的に除外したものだけ。
// ============================================================================

const ROOT = join(__dirname, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const FILES = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
  .filter(f => !f.includes('super-admin'))          // トグルの定義側は数えない
  .filter(f => !f.endsWith(join('lib', 'features.ts')))

const SOURCE = FILES.map(f => readFileSync(f, 'utf8')).join('\n')

/** そのキーが「機能の可否判定」として読まれているか */
function isGated(key: string): boolean {
  return [
    `hasFeature('${key}')`,
    `resolveFeature('${key}'`,
    `features['${key}']`,
    `featureKey: '${key}'`,
  ].some(pat => SOURCE.includes(pat))
}

// super-admin に並ぶトグル = カタログそのもの（手書きの二重管理をやめた）
const TOGGLES: FeatureKey[] = FEATURE_KEYS_IN_CATALOG

/**
 * トグルはあるが、まだどこも見ていないもの。
 * 実装（配線）したらこの配列から消すこと。
 * 空であることが正常。増やすなら「なぜ今は配線できないか」を必ず書く。
 */
const UNWIRED: FeatureKey[] = []

/** ソース中で実際に機能判定に使われているキーを全部拾う */
function gatedKeysInSource(): string[] {
  const found = new Set<string>()
  const patterns = [
    /hasFeature\('([a-z_]+)'\)/g,
    /resolveFeature\('([a-z_]+)'/g,
    /featureKey: '([a-z_]+)'/g,
    /feature: '([a-z_]+)'/g,
    /feature="([a-z_]+)"/g,
  ]
  for (const re of patterns) {
    Array.from(SOURCE.matchAll(re)).forEach(m => found.add(m[1]))
  }
  return Array.from(found)
}

describe('機能トグルと画面の対応', () => {
  it('未実装リストに載っていないトグルは、必ずどこかで判定に使われている', () => {
    const dead = TOGGLES.filter(k => !UNWIRED.includes(k) && !isGated(k))
    expect(dead).toEqual([])
  })

  it('未実装リストの項目は、本当にどこでも使われていない（実装したら消す）', () => {
    const nowWired = UNWIRED.filter(k => isGated(k))
    expect(nowWired).toEqual([])
  })

  // 逆方向。products が「LINE追加購入・商品マスタ」を制御しているのにトグルが
  // 無く、運用側から存在を知る術が無かった事故の再発防止。
  it('画面で使われているキーは、必ず機能カタログに載っている（設定できない隠し機能を作らない）', () => {
    const catalog = new Set<string>(FEATURE_KEYS_IN_CATALOG)
    const retired = new Set<string>(RETIRED_FEATURE_KEYS)
    const hidden = gatedKeysInSource()
      .filter(k => !catalog.has(k) && !retired.has(k))
      // 機能キー以外の同名プロパティを拾った場合の除外（feature: 'xxx' の誤検出）
      .filter(k => k.length > 2)
    expect(hidden).toEqual([])
  })

  it('引退したキーは本当にどこからも読まれていない', () => {
    const stillUsed = RETIRED_FEATURE_KEYS.filter(k => isGated(k))
    expect(stillUsed).toEqual([])
  })

  it('順番待ちQR POPは順番待ちタブの可否を見る（切っても作れてしまう不具合の再発防止）', () => {
    const page = readFileSync(join(ROOT, 'app/[storeId]/admin/settings/queue-pop/page.tsx'), 'utf8')
    expect(page).toContain('tab_queue')
  })

  it('プラン別画面は入口だけでなくページ側でも判定する（URL直打ち対策）', () => {
    const pages: [string, string][] = [
      ['app/[storeId]/admin/settings/queue-pop/page.tsx',      'tab_queue'],
      ['app/[storeId]/admin/master/repair/page.tsx',           'repairs_master'],
      ['app/[storeId]/admin/master/repair-vendors/page.tsx',   'repairs_master'],
      ['app/[storeId]/admin/master/ocr-templates/page.tsx',    'repairs_ocr'],
      ['app/[storeId]/admin/settings/reservation/page.tsx',    'reservation'],
    ]
    for (const [rel, key] of pages) {
      expect(readFileSync(join(ROOT, rel), 'utf8'), rel).toContain(key)
    }
  })
})
