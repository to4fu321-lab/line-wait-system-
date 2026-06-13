import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

// 番号を大きく描いた「整理券/注文番号」画像を動的生成する。
// LINE Flex の hero 画像として利用。
//   /api/og/ticket?no=042&name=山田&store=○○店&label=整理番号&kind=call
//
// kind ごとにアクセント色を変える（lib/line-flex.ts の THEMES と対応）。
const ACCENTS: Record<string, string> = {
  call:       '#E53935',
  registered: '#43A047',
  soon:       '#FB8C00',
  order:      '#1E88E5',
  ready:      '#43A047',
  info:       '#546E7A',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const no    = searchParams.get('no')    ?? '---'
  const name  = searchParams.get('name')  ?? ''
  const store = searchParams.get('store') ?? ''
  const label = searchParams.get('label') ?? '番号'
  const kind  = searchParams.get('kind')  ?? 'info'
  const accent = ACCENTS[kind] ?? ACCENTS.info

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
          fontFamily: 'sans-serif',
        }}
      >
        {/* アクセントの上下帯 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, backgroundColor: accent }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, backgroundColor: accent }} />

        {store ? (
          <div style={{ fontSize: 34, color: '#667085', fontWeight: 700, marginBottom: 8 }}>{store}</div>
        ) : null}

        <div style={{ fontSize: 30, color: '#98A2B3', letterSpacing: 4, marginBottom: 4 }}>{label}</div>

        <div style={{ display: 'flex', fontSize: 220, fontWeight: 900, color: accent, lineHeight: 1 }}>
          {no}
        </div>

        {name ? (
          <div style={{ fontSize: 44, color: '#1D2939', fontWeight: 700, marginTop: 16 }}>{name} 様</div>
        ) : null}
      </div>
    ),
    { width: 800, height: 520 }
  )
}
