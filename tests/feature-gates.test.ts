import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { FeatureKey } from '@/lib/features'

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

// super-admin に並ぶトグル（app/super-admin/page.tsx の GRANULAR_FEATURES と同じ並び）
const TOGGLES: FeatureKey[] = [
  'tab_queue', 'tab_repairs', 'tab_inquiries', 'tab_crm',
  'repairs_tab_purchase', 'repairs_tab_arrival', 'repairs_tab_delivery',
  'repairs_ocr', 'repairs_master', 'repairs_dummy',
  'kantan_line', 'tray_scan', 'reservation', 'orders', 'takeout',
  'school_master', 'school_ocr', 'school_crm_card', 'school_measurement',
  'school_waiting', 'line_parent_info', 'line_coupon', 'line_parent_rsv',
  'customer_self_intake', 'customer_self_order',
  'sms_notify', 'today_tasks_ui', 'pos',
  'shift_management', 'shift_inter_store', 'shift_attendance', 'shift_leave',
  'shift_swap', 'staff_push', 'shift_demand', 'shift_dashboard', 'shift_ai',
]

/**
 * トグルはあるが中身が無い（未実装）。
 * 実装したらこの配列から消すこと。増やすときは本当に未実装かを確認する。
 */
const UNWIRED: FeatureKey[] = [
  'orders',                // 注文管理: 専用画面が無い
  'school_master',         // 学校マスター管理: 画面は products で出しており、このキーは未使用
  'school_ocr',            // 学校規定OCR取込: 未実装
  'line_parent_info',      // LINE保護者情報投稿: 未実装
  'line_parent_rsv',       // LINE採寸予約（保護者）: 未実装
  'customer_self_intake',  // お客様セルフ依頼入力: 未実装
]

describe('機能トグルと画面の対応', () => {
  it('未実装リストに載っていないトグルは、必ずどこかで判定に使われている', () => {
    const dead = TOGGLES.filter(k => !UNWIRED.includes(k) && !isGated(k))
    expect(dead).toEqual([])
  })

  it('未実装リストの項目は、本当にどこでも使われていない（実装したら消す）', () => {
    const nowWired = UNWIRED.filter(k => isGated(k))
    expect(nowWired).toEqual([])
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
    ]
    for (const [rel, key] of pages) {
      expect(readFileSync(join(ROOT, rel), 'utf8'), rel).toContain(key)
    }
  })
})
