import { describe, it, expect } from 'vitest'
import { resolveFeature, ADDON_DEFAULT_OFF, PLAN_DEFS } from '@/lib/features'
import { canCustomerOrder, canCustomerRepair } from '@/lib/customerFeatures'

describe('resolveFeature', () => {
  it('フルプランでは pos・shift_* がプラン定義通り有効になる（2026-07-05修正）', () => {
    const rawFeatures = { _plan: 'full' }
    expect(resolveFeature('pos', rawFeatures)).toBe(true)
    expect(resolveFeature('shift_management', rawFeatures)).toBe(true)
    expect(resolveFeature('shift_attendance', rawFeatures)).toBe(true)
    expect(resolveFeature('shift_leave', rawFeatures)).toBe(true)
    expect(resolveFeature('shift_swap', rawFeatures)).toBe(true)
    expect(resolveFeature('staff_push', rawFeatures)).toBe(true)
    expect(resolveFeature('shift_dashboard', rawFeatures)).toBe(true)
  })

  it('プランが pos/shift_* を false にしていれば false のまま', () => {
    const rawFeatures = { _plan: 'free_trial' }
    expect(resolveFeature('pos', rawFeatures)).toBe(false)
    expect(resolveFeature('shift_management', rawFeatures)).toBe(false)
  })

  it('個別フラグの明示的な上書きはプランより常に優先される', () => {
    expect(resolveFeature('pos', { _plan: 'full', pos: false })).toBe(false)
    expect(resolveFeature('pos', { _plan: 'free_trial', pos: true })).toBe(true)
  })

  it('sms_notify・today_tasks_ui は課金/β機能のため個別フラグなしでは常にOFF', () => {
    const rawFeatures = { _plan: 'full' }
    expect(resolveFeature('sms_notify', rawFeatures)).toBe(false)
    expect(resolveFeature('today_tasks_ui', rawFeatures)).toBe(false)
    // 個別フラグをONにすれば有効化できる
    expect(resolveFeature('sms_notify', { ...rawFeatures, sms_notify: true })).toBe(true)
  })

  it('ADDON_DEFAULT_OFF に pos・shift_* が含まれない', () => {
    expect(ADDON_DEFAULT_OFF).not.toContain('pos')
    for (const key of ['shift_management', 'shift_inter_store', 'shift_attendance', 'shift_leave', 'shift_swap', 'staff_push', 'shift_demand', 'shift_dashboard', 'shift_ai'] as const) {
      expect(ADDON_DEFAULT_OFF).not.toContain(key)
    }
  })

  it('full プラン定義自体が pos・主要shift機能を true にしている', () => {
    expect(PLAN_DEFS.full.features.pos).toBe(true)
    expect(PLAN_DEFS.full.features.shift_management).toBe(true)
    expect(PLAN_DEFS.full.features.shift_attendance).toBe(true)
  })
})

// お客様LINE側は「入口のボタン」と「開いた先の画面」で判定がずれやすく、
// 実際に「ネット注文ボタンは出るのに押すと使えない」状態が起きた。
// 判定は lib/customerFeatures に集約したので、その規則をここで固定する。
describe('お客様LINEから使えるかの判定', () => {
  it('ネット注文は 商品マスタ と セルフ注文 の両方が必要', () => {
    expect(canCustomerOrder({ products: true,  customer_self_order: true  })).toBe(true)
    expect(canCustomerOrder({ products: true,  customer_self_order: false })).toBe(false)
    expect(canCustomerOrder({ products: false, customer_self_order: true  })).toBe(false)
  })

  it('お直し特化プランは商品マスタをONにしてもネット注文は開かない（セルフ注文が既定OFF）', () => {
    expect(canCustomerOrder({ _plan: 'repairs_focus', products: true })).toBe(false)
    expect(canCustomerOrder({ _plan: 'repairs_focus', products: true, customer_self_order: true })).toBe(true)
  })

  it('LINEからのお直し依頼は お直し機能 と セルフ依頼入力 の両方が必要', () => {
    expect(canCustomerRepair({ repairs: true,  customer_self_intake: true  })).toBe(true)
    expect(canCustomerRepair({ repairs: true,  customer_self_intake: false })).toBe(false)
    expect(canCustomerRepair({ repairs: false, customer_self_intake: true  })).toBe(false)
  })
})
