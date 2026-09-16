import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  商品マスタのテナント分離を、コードの形として固定する
//
//  背景: マスタ一式は anon キー(=公開キー)に開いたうえで RLS 全許可だったため、
//  他店の商品・価格を読むことも書き換えることもできた。対策としてブラウザからの
//  直接アクセスを禁止し、store_id をサーバー側で固定する API に寄せた。
//
//  「うっかり supabase.from('products') に戻す」のが一番ありがちな退行なので、
//  ここで機械的に見張る。
// ============================================================================

const ROOT = join(__dirname, '..')

/** 店舗ごとに分離すべきマスタ（テーブル + 互換ビュー） */
const MASTER_TABLES = [
  'schools', 'size_sets', 'size_set_items', 'products',
  'school_requirements', 'prices', 'processing_options',
  'school_products', 'school_product_variants', 'school_items',
]

/**
 * 直アクセスが残ることを許す例外。
 *   admin/products/page.tsx は旧スキーマ専用の残骸で、現行DBでは元から動かない。
 *   移植しても動かないため据え置き（ファイル先頭に警告あり）。
 */
const ALLOWED = ['app/[storeId]/admin/products/page.tsx']

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

/** サーバー(app/api 配下)は service_role で動くので対象外 */
function clientFiles(): string[] {
  return [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))]
    .map(f => f.slice(ROOT.length + 1))
    .filter(f => !f.startsWith('app/api/'))
    .filter(f => !ALLOWED.includes(f))
}

describe('商品マスタのテナント分離', () => {
  it('ブラウザ側のコードはマスタを直接読み書きしない', () => {
    const offenders: string[] = []
    for (const rel of clientFiles()) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      for (const table of MASTER_TABLES) {
        if (src.includes(`from('${table}')`) || src.includes(`from("${table}")`)) {
          offenders.push(`${rel} → ${table}`)
        }
      }
    }
    expect(offenders, 'マスタは /api/master/* 経由にしてください（lib/masterApi.ts）').toEqual([])
  })

  it('マスタAPIは store_id を必ず絞っている', () => {
    for (const rel of ['app/api/master/catalog/route.ts', 'app/api/master/crud/route.ts']) {
      const src = readFileSync(join(ROOT, rel), 'utf8')
      // from(...) の回数より eq('store_id'...) の回数が少ないと、絞り漏れの疑いがある
      const froms = (src.match(/\.from\(/g) ?? []).length
      const scoped = (src.match(/store_id/g) ?? []).length
      expect(scoped, `${rel} に store_id の絞り込みが足りません`).toBeGreaterThanOrEqual(froms)
    }
  })

  it('CRUD API は店舗PINを検証してから実行する', () => {
    const src = readFileSync(join(ROOT, 'app/api/master/crud/route.ts'), 'utf8')
    expect(src).toContain('assertStorePin')
    // 認証より前に DB を触っていないこと
    expect(src.indexOf('assertStorePin')).toBeLessThan(src.indexOf('createAdminClient('))
  })

  it('公開カタログは仕入原価を返さない', () => {
    const src = readFileSync(join(ROOT, 'app/api/master/catalog/route.ts'), 'utf8')
    // select 句に cost を含めていないこと(コメント中の言及は除く)
    const selects = src.match(/\.select\(([^)]*)\)/g) ?? []
    expect(selects.length).toBeGreaterThan(0)
    for (const s of selects) expect(s).not.toMatch(/\bcost\b/)
  })

  it('クライアントは書き込み列を allowlist 経由でしか渡せない', () => {
    const src = readFileSync(join(ROOT, 'app/api/master/crud/route.ts'), 'utf8')
    // store_id は payload から捨てて、認証済みの storeId を入れ直す作りであること
    expect(src).toContain('store_id: storeId')
    const fields = src.slice(src.indexOf('const FIELDS'), src.indexOf('} as const'))
    expect(fields, 'store_id を書き込み可能列に入れてはいけません').not.toContain("'store_id'")
  })

  it('anon から権限を剥奪するマイグレーションがある', () => {
    const dir = join(ROOT, 'supabase/migrations')
    const hit = readdirSync(dir)
      .map(f => readFileSync(join(dir, f), 'utf8'))
      .some(sql => /REVOKE ALL ON public\.%I FROM anon, authenticated/.test(sql))
    expect(hit, 'マスタの GRANT を剥奪するマイグレーションが見つかりません').toBe(true)
  })
})
