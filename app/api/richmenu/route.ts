export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'

const STORE_ID  = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID || process.env.STORE_ID || ''
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}`
const LINE_API  = 'https://api.line.me/v2/bot'
const authHeader = { Authorization: `Bearer ${TOKEN}` }

// ── リッチメニュー画像生成（next/og + Google Fonts）──────────
async function makeMenuPng(): Promise<Buffer> {
  let fontData: ArrayBuffer | null = null
  try {
    const chars = encodeURIComponent('採寸の順番待ちをする来店予約依頼ネット注文')
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${chars}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) fontData = await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }

  const sections = [
    { lines: ['採寸の', '順番待ちをする'], emoji: '📋', bg: '#4f46e5' },
    { lines: ['来店予約'],                emoji: '📅', bg: '#0d9488' },
    { lines: ['依頼'],                    emoji: '✂️', bg: '#7c3aed' },
    { lines: ['ネット注文'],              emoji: '🛍️', bg: '#2563eb' },
  ]

  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', width: 2500, height: 843, fontFamily } },
      ...sections.map((s, i) =>
        h('div', {
          key: i,
          style: {
            width: 625, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: `linear-gradient(160deg, ${s.bg} 0%, ${s.bg}cc 100%)`,
            borderRight: i < 3 ? '4px solid rgba(255,255,255,0.3)' : 'none',
          },
        },
          h('div', { style: { fontSize: 130, lineHeight: 1 } }, s.emoji),
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
            ...s.lines.map((line, j) =>
              h('div', {
                key: j,
                style: { fontSize: 90, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 },
              }, line)
            )
          )
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

    // 2. 新規メニュー作成（4列: 採寸の順番待ち / 来店予約 / 依頼 / ネット注文）
    const createRes = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: { width: 2500, height: 843 },
        selected: true,
        name: storeName ?? 'メニュー',
        chatBarText: 'メニュー',
        areas: [
          { bounds: { x: 0,    y: 0, width: 625, height: 843 }, action: { type: 'uri', uri: `${base}?action=queue`,   label: '今すぐ採寸の順番待ちに並ぶ' } },
          { bounds: { x: 625,  y: 0, width: 625, height: 843 }, action: { type: 'uri', uri: `${base}/reserve`,        label: '来店予約' } },
          { bounds: { x: 1250, y: 0, width: 625, height: 843 }, action: { type: 'uri', uri: `${base}/repair`,         label: '依頼' } },
          { bounds: { x: 1875, y: 0, width: 625, height: 843 }, action: { type: 'uri', uri: `${base}?action=purchase`, label: 'ネット注文' } },
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
