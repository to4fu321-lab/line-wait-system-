import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabaseAdmin'

const supabase = createAdminClient()

function jstToday() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

function jstTomorrow() {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  try {
    const { storeId, mode, handoverNote } = await req.json()
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

    const today = jstToday()
    const tomorrow = jstTomorrow()
    const todayStart = `${today}T00:00:00+09:00`
    const tomorrowStart = `${tomorrow}T00:00:00+09:00`

    // ── データ取得（並列・開店/閉店共通） ──────────────────────────────
    const [
      { data: reservations },
      { data: repairsDueToday },
      { data: repairsCompleted },
      { data: urgentInquiries },
      { data: arrivedOrders },
    ] = await Promise.all([
      // 今日の予約（confirmed）
      supabase.from('reservations')
        .select('reserved_at, purpose, notes')
        .eq('store_id', storeId)
        .gte('reserved_at', todayStart)
        .lt('reserved_at', tomorrowStart)
        .in('status', ['confirmed', 'arrived'])
        .order('reserved_at'),

      // 納期が今日以前で未渡しのお直し
      supabase.from('repair_histories')
        .select('item_name, desired_completion_date, status')
        .eq('store_id', storeId)
        .lte('desired_completion_date', today)
        .not('status', 'eq', 'delivered')
        .order('desired_completion_date'),

      // 作業完了済みで未渡しのお直し
      supabase.from('repair_histories')
        .select('item_name, customer_id')
        .eq('store_id', storeId)
        .eq('status', 'completed')
        .is('delivered_date', null),

      // 緊急・未対応の問合せ
      supabase.from('inquiries')
        .select('content, type')
        .eq('store_id', storeId)
        .eq('is_urgent', true)
        .eq('status', 'pending'),

      // 入荷済みで未連絡の発注品
      supabase.from('purchase_orders')
        .select('item_name')
        .eq('store_id', storeId)
        .eq('status', 'arrived'),
    ])

    const client = new Anthropic()
    const dateStr = new Date().toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'long', day: 'numeric', weekday: 'short',
    })

    if (mode === 'open') {
      // ── 開店ブリーフィング ────────────────────────────────
      const prompt = `あなたは学生服店のアシスタントです。
以下のデータをもとに、今日の開店ブリーフィングを日本語で生成してください。

【今日の日付】${dateStr}
【引継ぎメモ（前日）】${handoverNote || 'なし'}
【今日の予約】${reservations?.length ?? 0}件${reservations?.length ? '\n' + reservations.map(r => `・${new Date(r.reserved_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} ${r.purpose ?? '来店予約'}`).join('\n') : ''}
【納期が本日以前のお直し（未渡し）】${repairsDueToday?.length ?? 0}件
【作業完了済み・未渡し】${repairsCompleted?.length ?? 0}件
【緊急問合せ（未対応）】${urgentInquiries?.length ?? 0}件
【入荷済み・未連絡】${arrivedOrders?.length ?? 0}件

ルール：
- 箇条書きを使わず、自然な会話口調で150字以内にまとめる
- 重要なことだけを優先して伝える（全部を羅列しない）
- 「おはようございます」で始める
- 数字がすべて0の場合は「今日は落ち着いたスタートですね」のように前向きに締める`

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      })

      const briefing = (message.content[0] as { text: string }).text

      return NextResponse.json({
        ok: true,
        briefing,
        stats: {
          reservations: reservations?.length ?? 0,
          repairsDue: repairsDueToday?.length ?? 0,
          repairsReady: repairsCompleted?.length ?? 0,
          urgentInquiries: urgentInquiries?.length ?? 0,
          arrivedOrders: arrivedOrders?.length ?? 0,
        },
      })
    } else {
      // ── 閉店チェックリスト＆サマリー ──────────────────────
      // 今日受付したお直し（閉店サマリー専用）
      const { data: todayRepairsReceived } = await supabase
        .from('repair_histories')
        .select('id')
        .eq('store_id', storeId)
        .gte('received_date', today)

      const checklist = [
        ...(repairsDueToday?.length ? [{
          label: `納期が来ているお直しの確認（${repairsDueToday.length}件）`,
          count: repairsDueToday.length,
        }] : []),
        ...(repairsCompleted?.length ? [{
          label: `完了済み・未渡しのお直し（${repairsCompleted.length}件）`,
          count: repairsCompleted.length,
        }] : []),
        ...(arrivedOrders?.length ? [{
          label: `入荷済み品のお客様への連絡（${arrivedOrders.length}件）`,
          count: arrivedOrders.length,
        }] : []),
        ...(urgentInquiries?.length ? [{
          label: `緊急問合せへの返答（${urgentInquiries.length}件）`,
          count: urgentInquiries.length,
        }] : []),
        { label: 'レジ締め完了', count: 0 },
        { label: '鍵・戸締まりの確認', count: 0 },
      ]

      const prompt = `あなたは学生服店のアシスタントです。
以下のデータをもとに、今日の営業サマリーを日本語で生成してください。

【今日の日付】${dateStr}
【今日受付したお直し】${todayRepairsReceived?.length ?? 0}件
【今日の予約来店】${reservations?.length ?? 0}件
【納期が来ているお直し（未渡し）】${repairsDueToday?.length ?? 0}件
【作業完了済み・未渡し】${repairsCompleted?.length ?? 0}件

ルール：
- 80字以内で今日の一言サマリーを生成
- 「お疲れ様でした」で始める
- 明日に持ち越す件数があれば一言触れる`

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      })

      const summary = (message.content[0] as { text: string }).text

      return NextResponse.json({
        ok: true,
        checklist,
        summary,
        stats: {
          repairsDue: repairsDueToday?.length ?? 0,
          repairsReady: repairsCompleted?.length ?? 0,
          urgentInquiries: urgentInquiries?.length ?? 0,
          arrivedOrders: arrivedOrders?.length ?? 0,
          todayRepairs: todayRepairsReceived?.length ?? 0,
          todayReservations: reservations?.length ?? 0,
        },
      })
    }
  } catch (e) {
    console.error('[briefing]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
