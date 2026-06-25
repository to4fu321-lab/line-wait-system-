export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { AreaCode, AREA_DEFS } from '@/lib/features'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// Area-specific season context for uniform stores
const AREA_SEASON_CONTEXT: Record<AreaCode, string> = {
  north:   '北海道・東北エリア。雪が多く冬が長い。春の入学シーズンが遅め。',
  central: '関東・中部・近畿エリア。四季が明確。梅雨・夏が蒸し暑い。',
  south:   '中国・四国・九州エリア。温暖。夏が長く台風シーズンあり。',
  okinawa: '沖縄・南西諸島。亜熱帯気候。真冬でも暖かく、夏は非常に暑い。',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')

  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId が必要です' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Fetch store features
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('features')
    .eq('id', storeId)
    .single()

  if (storeErr || !store) {
    return NextResponse.json({ ok: false, error: 'ストアが見つかりません' }, { status: 404 })
  }

  const features = (store.features ?? {}) as Record<string, unknown>
  const area = (features.area as AreaCode | undefined) ?? 'central'
  const currentWeek = getISOWeek(new Date())

  // Return cached message if same week
  const cache = features.season_msg_cache as { week?: string; text?: string; area?: string } | undefined
  if (cache?.week === currentWeek && cache?.text && cache?.area === area) {
    return NextResponse.json({ ok: true, text: cache.text, week: currentWeek, area, cached: true })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY が未設定です' }, { status: 500 })
  }

  // Build context for AI
  const now = new Date()
  const month = now.getMonth() + 1
  const areaInfo = AREA_DEFS[area]
  const areaContext = AREA_SEASON_CONTEXT[area]

  const prompt = `あなたは学生服販売店のスタッフ向けダッシュボードに表示するメッセージを生成します。
エリア: ${areaInfo.label}（${areaContext}）
現在: ${now.getFullYear()}年${month}月・${currentWeek}

このエリアの学生服販売店スタッフが今週最も意識すべきことを、1〜2文（最大60文字）で簡潔に書いてください。
- 季節・時期に合った在校生・新入生への対応
- 繁忙期・閑散期の特徴
- 今の時期の主な業務（夏服・冬服切り替え、採寸、注文ピーク等）
- 絵文字を1つ使ってOK
- 語尾は「〜です。」「〜ましょう。」等の丁寧語
メッセージのみを返してください（説明不要）。`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (message.content[0] as { type: string; text: string }).text?.trim() ?? ''

    // Cache result in store features
    await supabase
      .from('stores')
      .update({
        features: {
          ...features,
          season_msg_cache: { week: currentWeek, text, area },
        },
      })
      .eq('id', storeId)

    return NextResponse.json({ ok: true, text, week: currentWeek, area, cached: false })
  } catch (err) {
    console.error('[season-message] AI error:', err)
    return NextResponse.json({ ok: false, error: 'AIメッセージ生成に失敗しました' }, { status: 500 })
  }
}
