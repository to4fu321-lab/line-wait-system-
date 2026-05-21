import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'

const STORE_ID  = process.env.STORE_ID || '00000000-0000-0000-0000-000000000010'
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='
const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'}`
const LINE_API  = 'https://api.line.me/v2/bot'
const authHeader = { Authorization: `Bearer ${TOKEN}` }

// ── リッチメニュー画像生成（next/og + Google Fonts）──────────
async function makeMenuPng(): Promise<Buffer> {
  // Google Fonts から Noto Sans JP サブセットを取得（日本語テキスト用）
  let fontData: ArrayBuffer | null = null
  try {
    const chars = encodeURIComponent('採寸ご購入お直し取り置き注文')
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${chars}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) fontData = await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }

  const sections = [
    { label: '採寸・ご購入', sub: '順番待ち',   emoji: '📋', bg: '#4f46e5' },
    { label: 'お直し',       sub: 'スタッフ対応', emoji: '✂️', bg: '#7c3aed' },
    { label: '取り置き注文', sub: 'スタッフ対応', emoji: '🛍️', bg: '#2563eb' },
  ]

  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', width: 2500, height: 843, fontFamily } },
      ...sections.map((s, i) =>
        h('div', {
          key: i,
          style: {
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
            background: `linear-gradient(160deg, ${s.bg} 0%, ${s.bg}cc 100%)`,
            borderRight: i < 2 ? '4px solid rgba(255,255,255,0.3)' : 'none',
          },
        },
          h('div', { style: { fontSize: 130, lineHeight: 1 } }, s.emoji),
          h('div', { style: { fontSize: 68, fontWeight: 700, color: '#fff', letterSpacing: '-1px' } }, s.label),
          h('div', { style: { fontSize: 42, color: 'rgba(255,255,255,0.72)' } }, s.sub),
        )
      )
    ),
    {
      width: 2500, height: 843,
      fonts: fontData
        ? [{ name: 'Noto Sans JP', data: fontData, weight: 700, style: 'normal' as const }]
        : [],
    }
  )

  return Buffer.from(await img.arrayBuffer())
}

// GET ?storeId=&storeName= → ブラウザから直接設定可能
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const storeId   = searchParams.get('storeId')   ?? STORE_ID
  const storeName = searchParams.get('storeName')  ?? 'メニュー'
  const fakeReq = { json: async () => ({ storeId, storeName }) } as unknown as NextRequest
  return POST(fakeReq)
}

// POST { storeId, storeName } → リッチメニュー作成・全ユーザー適用
export async function POST(req: NextRequest) {
  try {
    const { storeId, storeName } = await req.json()
    if (!storeId) return NextResponse.json({ ok: false, error: 'storeId required' }, { status: 400 })

    const base = `${LIFF_BASE}/${storeId}`

    // 1. 既存メニューを全削除
    const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
    if (listRes.ok) {
      const { richmenus } = await listRes.json()
      await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
        fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
      ))
    }

    // 2. 新規メニュー作成
    const createRes = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: { width: 2500, height: 843 },
        selected: true,
        name: storeName ?? 'メニュー',
        chatBarText: 'メニュー',
        areas: [
          { bounds: { x: 0,    y: 0, width: 833,  height: 843 }, action: { type: 'uri', uri: `${base}?action=queue`,    label: '採寸・ご購入' } },
          { bounds: { x: 833,  y: 0, width: 834,  height: 843 }, action: { type: 'uri', uri: `${base}?action=repair`,   label: 'お直し' } },
          { bounds: { x: 1667, y: 0, width: 833,  height: 843 }, action: { type: 'uri', uri: `${base}?action=purchase`, label: '取り置き注文' } },
        ],
      }),
    })
    if (!createRes.ok) {
      const err = await createRes.text()
      return NextResponse.json({ ok: false, error: `create: ${err}` }, { status: 500 })
    }
    const { richMenuId } = await createRes.json()

    // 3. 画像アップロード
    const png = await makeMenuPng()
    const imgRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'image/png' },
      body: png as unknown as BodyInit,
    })
    if (!imgRes.ok) console.warn('[richmenu] image upload:', await imgRes.text())

    // 4. 全ユーザーに適用
    await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
      method: 'POST', headers: authHeader,
    })

    return NextResponse.json({ ok: true, richMenuId })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// DELETE → 全リッチメニュー削除
export async function DELETE() {
  const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
  if (listRes.ok) {
    const { richmenus } = await listRes.json()
    await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
      fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
    ))
  }
  return NextResponse.json({ ok: true })
}
