import Anthropic from '@anthropic-ai/sdk'

export type FeedbackPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface FeedbackAiResult {
  priority: FeedbackPriority
  category: string
  recommendation: string
  implementable: boolean
}

const KIND_LABEL: Record<string, string> = { request: '要望', bug: '不具合', question: '質問' }

const PRIORITIES: FeedbackPriority[] = ['urgent', 'high', 'medium', 'low']

/**
 * 現場フィードバックをAIでトリアージする。優先度・分類・対応方針を判定し、
 * 軽微で安全な修正としてPR自動作成の対象にできそうかを implementable で返す。
 * 失敗時は null を返し、呼び出し側は非致命的に扱う（投稿自体は止めない）。
 */
export async function analyzeFeedback(input: {
  kind: string
  body: string
  storeName?: string | null
}): Promise<FeedbackAiResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const kindLabel = KIND_LABEL[input.kind] ?? input.kind

  const prompt = `あなたは制服販売店向け業務システム（Next.js / Supabase / Tailwind）の保守担当です。
店頭スタッフから届いた以下のフィードバックを分析し、JSON形式のみで回答してください（コードブロック不要）。

【種別】${kindLabel}
${input.storeName ? `【店舗】${input.storeName}\n` : ''}【内容】
${input.body}

判断基準:
- 不具合（バグ）は業務が止まる・データが壊れるなど影響が大きいほど優先度を上げる（原則 medium 以上）。
- 要望は内容次第で優先度を決める（多くのスタッフに影響する／業務効率に直結するものは高く、些細な見た目の好みは低く）。
- 質問はコード修正の対象ではないので implementable は必ず false。
- implementable は「影響範囲が狭く自明で、AIが安全に自動修正・PR作成できる」と確信できる場合のみ true。
  設計判断や大規模変更、仕様が曖昧なものは false。

以下のJSON形式のみを返してください:
{
  "priority": "urgent" | "high" | "medium" | "low",
  "category": "分類を短い日本語で（例: 軽微な修正 / 機能追加 / 要設計判断 / 質問対応）",
  "recommendation": "原因の推定・対応方針の提案を2〜4文の日本語で",
  "implementable": true | false
}`

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    const jsonText = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonText) as Partial<FeedbackAiResult>

    if (!parsed.priority || !PRIORITIES.includes(parsed.priority)) return null
    if (typeof parsed.category !== 'string' || typeof parsed.recommendation !== 'string') return null

    return {
      priority: parsed.priority,
      category: parsed.category,
      recommendation: parsed.recommendation,
      implementable: input.kind !== 'question' && parsed.implementable === true,
    }
  } catch {
    return null
  }
}
