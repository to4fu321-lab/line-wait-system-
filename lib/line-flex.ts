// ============================================================
// LINE Flex メッセージ共通ビルダー
// ------------------------------------------------------------
// 各 notify-* ルートで共通利用する。
//   - buildNumberCard:  番号を大きく見せる通知カード（呼び出し/入荷など）
//   - buildProgressCard: EC風ステップトラッカー付きの進捗カード
//   - pushFlex / pushText: LINE push 送信ヘルパー
//   - ogTicketUrl: 番号を画像化する OG エンドポイントの絶対URL生成
// ============================================================

export type FlexJson = Record<string, any>

// ── 配色テーマ ──────────────────────────────────────────────
// kind ごとにヘッダー/アクセント色を切り替える
export type CardKind =
  | 'call'       // 呼び出し（赤系）
  | 'registered' // 受付完了（緑系）
  | 'soon'       // まもなく呼び出し（橙系）
  | 'order'      // 注文受付/進捗（青系）
  | 'ready'      // 完成・入荷・完了（緑系）
  | 'info'       // 一般情報（グレー系）

interface Theme {
  accent: string // アクセント（ヘッダー背景・番号色）
  emoji:  string
}

const THEMES: Record<CardKind, Theme> = {
  call:       { accent: '#E53935', emoji: '🔔' },
  registered: { accent: '#43A047', emoji: '✅' },
  soon:       { accent: '#FB8C00', emoji: '⏰' },
  order:      { accent: '#1E88E5', emoji: '🧾' },
  ready:      { accent: '#43A047', emoji: '🎉' },
  info:       { accent: '#546E7A', emoji: 'ℹ️' },
}

export function themeOf(kind: CardKind): Theme {
  return THEMES[kind] ?? THEMES.info
}

// ── OG画像（動的生成された番号画像）のURL ───────────────────
// origin は notify ルートで `new URL(req.url).origin` から渡す。
export function resolveOrigin(reqUrl?: string): string {
  if (reqUrl) {
    try { return new URL(reqUrl).origin } catch { /* noop */ }
  }
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  return process.env.NEXT_PUBLIC_BASE_URL || ''
}

export function ogTicketUrl(
  origin: string,
  params: { no: string; name?: string; store?: string; label?: string; kind?: CardKind }
): string | null {
  if (!origin) return null
  const q = new URLSearchParams()
  q.set('no', params.no)
  if (params.name)  q.set('name', params.name)
  if (params.store) q.set('store', params.store)
  if (params.label) q.set('label', params.label)
  if (params.kind)  q.set('kind', params.kind)
  return `${origin}/api/og/ticket?${q.toString()}`
}

// ============================================================
// ステップトラッカー（EC風進捗）
// ============================================================
export interface Step {
  label: string
}

// 現在地までを「完了」、currentIndex を「現在」、それ以降を「未到達」として
// 縦並びの進捗トラッカーを生成する。モバイルで崩れにくい縦リスト形式。
export function buildStepTracker(
  steps: Step[],
  currentIndex: number,
  accent: string
): FlexJson {
  const GRAY = '#D0D5DD'
  const GRAY_TEXT = '#98A2B3'

  const rows: FlexJson[] = []
  steps.forEach((s, i) => {
    const done    = i < currentIndex
    const current = i === currentIndex
    const dotColor = done || current ? accent : GRAY
    const icon     = done ? '✓' : current ? '●' : ''

    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      alignItems: 'center',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          width: '26px',
          height: '26px',
          cornerRadius: '13px',
          backgroundColor: dotColor,
          justifyContent: 'center',
          alignItems: 'center',
          contents: [
            { type: 'text', text: icon || ' ', color: '#FFFFFF', size: 'sm', weight: 'bold', align: 'center' },
          ],
        },
        {
          type: 'text',
          text: s.label,
          size: 'sm',
          gravity: 'center',
          color: current ? accent : done ? '#344054' : GRAY_TEXT,
          weight: current ? 'bold' : 'regular',
          flex: 1,
        },
        ...(current
          ? [{
              type: 'text',
              text: '現在',
              size: 'xs',
              align: 'end',
              gravity: 'center',
              color: '#FFFFFF',
              weight: 'bold',
            }]
          : []),
      ],
    })

    // ドット間のコネクタ（最後の行以外）
    if (i < steps.length - 1) {
      rows.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: '26px',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '2px',
                height: '14px',
                backgroundColor: i < currentIndex ? accent : GRAY,
                offsetStart: '12px',
                contents: [],
              },
            ],
          },
        ],
      })
    }
  })

  return { type: 'box', layout: 'vertical', spacing: 'none', contents: rows }
}

// ============================================================
// カードビルダー
// ============================================================
export interface CardOptions {
  kind: CardKind
  title: string              // ヘッダー見出し（例: お呼び出し中）
  storeName?: string
  numberLabel?: string       // 番号のキャプション（例: 整理番号 / 注文番号）
  number?: string            // 大きく表示する番号（例: 042 / A-12）
  customerName?: string      // 「〇〇 様」
  nameSuffix?: string        // 敬称（既定: 様。子ども向けは さん など）
  bodyLines?: string[]       // 明細など（商品リスト等）
  note?: string              // 補足メッセージ
  steps?: Step[]             // 進捗トラッカーを出す場合
  currentStep?: number       // steps の現在地
  buttonLabel?: string       // CTAボタン文言
  buttonUrl?: string         // CTAリンク
  imageUrl?: string | null   // hero に表示する番号画像（OG）
}

export function buildBubble(opt: CardOptions): FlexJson {
  const theme = themeOf(opt.kind)
  const accent = theme.accent

  const bodyContents: FlexJson[] = []

  // 店舗名
  if (opt.storeName) {
    bodyContents.push({
      type: 'text', text: opt.storeName, size: 'sm', color: '#667085', weight: 'bold',
    })
  }

  // 番号（hero画像が無いときだけテキストで大きく出す）
  if (opt.number && !opt.imageUrl) {
    if (opt.numberLabel) {
      bodyContents.push({
        type: 'text', text: opt.numberLabel, size: 'xs', color: '#98A2B3', margin: 'md', align: 'center',
      })
    }
    bodyContents.push({
      type: 'text', text: opt.number, size: '5xl', weight: 'bold', color: accent,
      align: 'center', margin: opt.numberLabel ? 'none' : 'md',
    })
  }

  // 顧客名
  if (opt.customerName) {
    bodyContents.push({
      type: 'text', text: `${opt.customerName} ${opt.nameSuffix ?? '様'}`, size: 'md', weight: 'bold',
      align: 'center', color: '#1D2939', margin: 'sm',
    })
  }

  // 明細
  if (opt.bodyLines && opt.bodyLines.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'lg' })
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm',
      contents: opt.bodyLines.map(line => ({
        type: 'text', text: line, size: 'sm', color: '#344054', wrap: true,
      })),
    })
  }

  // 進捗トラッカー
  if (opt.steps && opt.steps.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'lg' })
    bodyContents.push({
      type: 'box', layout: 'vertical', margin: 'lg',
      contents: [buildStepTracker(opt.steps, opt.currentStep ?? 0, accent)],
    })
  }

  // 補足
  if (opt.note) {
    bodyContents.push({
      type: 'text', text: opt.note, size: 'sm', color: '#475467', wrap: true, margin: 'lg', align: 'center',
    })
  }

  const bubble: FlexJson = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: accent,
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: `${theme.emoji} ${opt.title}`,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'lg',
          align: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '20px',
      contents: bodyContents,
    },
  }

  // hero画像（OGで生成した番号画像）
  if (opt.imageUrl) {
    bubble.hero = {
      type: 'image',
      url: opt.imageUrl,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    }
  }

  // CTAボタン
  if (opt.buttonLabel && opt.buttonUrl) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: accent,
          action: { type: 'uri', label: opt.buttonLabel, uri: opt.buttonUrl },
        },
      ],
    }
  }

  return bubble
}

// Flex メッセージ全体（altText 付き）を生成
export function buildFlexMessage(altText: string, bubble: FlexJson): FlexJson {
  return { type: 'flex', altText, contents: bubble }
}

// ============================================================
// 送信ヘルパー
// ============================================================
export async function pushMessages(
  token: string,
  to: string,
  messages: FlexJson[]
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!token) return { ok: false, error: 'no_token' }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages }),
    })
    if (!res.ok) {
      const error = await res.text()
      return { ok: false, status: res.status, error }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// カード1枚を送る簡易ヘルパー
export async function pushCard(
  token: string,
  to: string,
  altText: string,
  opt: CardOptions
): Promise<{ ok: boolean; status?: number; error?: string }> {
  return pushMessages(token, to, [buildFlexMessage(altText, buildBubble(opt))])
}
