import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN_LIMITS, resolvePlan, getPlanLimits } from '@/lib/features'
import { parsePlanLimitError, PLAN_LIMIT_OWNER_MESSAGES, PLAN_LIMIT_CUSTOMER_MESSAGE, ownerPlanLimitMessage } from '@/lib/planLimitError'

// 無料トライアルは仕事管理・SMS/LINE連絡・顧客管理を人数/件数限定で使えるようにした。
// 上限そのもの(PLAN_LIMITS)と、上限に達したときの案内(parsePlanLimitError)を確認する。
describe('PLAN_LIMITS / resolvePlan / getPlanLimits', () => {
  it('無料体験にのみ数量上限がある', () => {
    expect(PLAN_LIMITS.free_trial).toEqual({ sms_per_month: 20, customers_max: 30, staff_max: 3 })
    expect(PLAN_LIMITS.full).toBeUndefined()
    expect(PLAN_LIMITS.standard).toBeUndefined()
  })

  it('resolvePlan は legacy エイリアスを解決する', () => {
    expect(resolvePlan({ _plan: 'intro' })).toBe('free_trial')
    expect(resolvePlan({ _plan: 'kantan' })).toBe('simple')
    expect(resolvePlan({})).toBe('full')
  })

  it('getPlanLimits は上限の無いプランでは空オブジェクトを返す', () => {
    expect(getPlanLimits({ _plan: 'full' })).toEqual({})
    expect(getPlanLimits({ _plan: 'free_trial' }).customers_max).toBe(30)
  })
})

describe('プラン上限エラーの文言変換', () => {
  it('DBトリガのマーカー文字列を機種別に判定できる', () => {
    expect(parsePlanLimitError('PLAN_LIMIT_EXCEEDED:staff_max')).toBe('staff_max')
    expect(parsePlanLimitError('duplicate key value violates unique constraint')).toBeNull()
    expect(parsePlanLimitError(undefined)).toBeNull()
    // Supabaseのエラーメッセージは前後に文言が付くことがある
    expect(parsePlanLimitError('insert failed: PLAN_LIMIT_EXCEEDED:customers_max')).toBe('customers_max')
  })

  it('店舗オーナー向けメッセージは3種類ともプラン変更への導線を含む', () => {
    for (const metric of ['customers_max', 'staff_max', 'sms_per_month'] as const) {
      expect(PLAN_LIMIT_OWNER_MESSAGES[metric]).toContain('契約プラン')
      expect(ownerPlanLimitMessage(metric)).toBe(PLAN_LIMIT_OWNER_MESSAGES[metric])
    }
  })

  it('LINE利用客向けメッセージは店舗の契約状況に触れない', () => {
    expect(PLAN_LIMIT_CUSTOMER_MESSAGE).not.toMatch(/プラン|トライアル|上限/)
  })
})

// lib/features.ts の数字と supabase/migrations の数字がズレると、
// アプリ側は「20件まで」と表示するのにDBは別の件数で止める、という事故になる。
describe('PLAN_LIMITS とDBトリガの数字が一致している', () => {
  const migration = readFileSync(
    join(__dirname, '..', 'supabase/migrations/20260903_plan_limits.sql'), 'utf8')

  it('customers_max・staff_max がマイグレーションのコメントと一致', () => {
    const limits = PLAN_LIMITS.free_trial!
    expect(migration).toMatch(new RegExp(`v_limit\\s*:=\\s*${limits.customers_max}\\b`))
    expect(migration).toMatch(new RegExp(`v_limit\\s*:=\\s*${limits.staff_max}\\b`))
  })
})
