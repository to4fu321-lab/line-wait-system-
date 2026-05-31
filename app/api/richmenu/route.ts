export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'
import { getLiffBaseUrl, getLineToken, type BizType } from '@/lib/line-config'

const LINE_API = 'https://api.line.me/v2/bot'

async function loadFont(chars: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(chars)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) return await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }
  return null
}

// 制服販売店用 3パネルメニュー
async function makeUniformMenuPng(): Promise<Buffer> {
  const fontData = await loadFont('採寸受付来店予約お直し依頼')
  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'

  const sections = [
    { label: '採寸・受付',  emoji: '📋', bg: '#4f46e5' },
    { label: '来店予約',    emoji: '📅', bg: '#0d9488' },
    { label: 'お直し依頼', emoji: '✂️', bg: '#7c3aed' },
  ]

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', width: 2500, height: 843, fontFamily } },
      ...sections.map((s, i) =>
        h('div', {
          key: i,
          style: {
            width: 833, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: `linear-gradient(160deg, ${s.bg} 0%, ${s.bg}cc 100%)`,
            borderRight: i < 2 ? '4px solid rgba(255,255,255,0.3)' : 'none',
          },
        },
          h('div', { style: { fontSize: 120, lineHeight: 1 } }, s.emoji),
          h('div', {
            style: { fontSize: 85, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1.15 },
          }, s.label)
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

// テイクアウト専門店用 2パネルメニュー
async function makeTakeoutMenuPng(): Promise<Buffer> {
  const fontData = await loadFont('テイクアウト注文注文状況確認')
  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'

  const sections = [
    { lines: ['テイクアウト', '注文'],  emoji: '🥡', bg: '#ea580c' },
    { lines: ['注文状況',     '確認'],  emoji: '📋', bg: '#0d9488' },
  ]

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', width: 2500, height: 843, fontFamily } },
      ...sections.map((s, i) =>
        h('div', {
          key: i,
          style: {
            width: 1250, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            background: `linear-gradient(160deg, ${s.bg} 0%, ${s.bg}cc 100%)`,
            borderRight: i < 1 ? '4px solid rgba(255,255,255,0.3)' : 'none',
          },
        },
          h('div', { style: { fontSize: 150, lineHeight: 1 } }, s.emoji),
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
            ...s.lines.map((line, j) =>
              h('div', {
                key: j,
                style: { fontSize: 96, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1.15 },
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

async function applyRichMenu(biz: BizType, menuName: string) {
  const token = getLineToken(biz)
  const liffBase = getLiffBaseUrl(biz)
  const authHeader = { Authorization: `Bearer ${token}` }

  if (!liffBase) throw new Error(`LIFF IDが未設定です (${biz})`)
  if (!token)    throw new Error(`LINE_CHANNEL_ACCESS_TOKEN が未設定です (${biz})`)

  // 1. 既存メニューを全削除
  const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
  if (listRes.ok) {
    const { richmenus } = await listRes.json()
    await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
      fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
    ))
  }

  let png: Buffer
  let areas: object[]

  if (biz === 'takeout') {
    const base = `${liffBase}/line-home-takeout`
    png = await makeTakeoutMenuPng()
    areas = [
      { bounds: { x:    0, y: 0, width: 1250, height: 843 }, action: { type: 'uri', uri: `${base}?action=order`,  label: 'テイクアウト注文' } },
      { bounds: { x: 1250, y: 0, width: 1250, height: 843 }, action: { type: 'uri', uri: `${base}?action=status`, label: '注文状況確認' } },
    ]
  } else {
    const base = `${liffBase}/line-home`
    png = await makeUniformMenuPng()
    areas = [
      { bounds: { x:    0, y: 0, width:  833, height: 843 }, action: { type: 'uri', uri: `${base}?action=queue`,   label: '採寸・受付' } },
      { bounds: { x:  833, y: 0, width:  833, height: 843 }, action: { type: 'uri', uri: `${base}?action=reserve`, label: '来店予約' } },
      { bounds: { x: 1666, y: 0, width:  834, height: 843 }, action: { type: 'uri', uri: `${base}?action=repair`,  label: 'お直し依頼' } },
    ]
  }

  // 2. メニュー作成
  const createRes = await fetch(`${LINE_API}/richmenu`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ size: { width: 2500, height: 843 }, selected: true, name: menuName, chatBarText: 'メニュー', areas }),
  })
  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`create richmenu: ${err}`)
  }
  const { richMenuId } = await createRes.json()

  // 3. 画像アップロード
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

  return richMenuId
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const biz = (searchParams.get('biz') ?? 'uniform') as BizType
  const name = searchParams.get('name') ?? ''
  const fakeReq = { json: async () => ({ biz, name }) } as unknown as NextRequest
  return POST(fakeReq)
}

// POST { biz: 'uniform' | 'takeout', name?: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const biz: BizType = body.biz === 'takeout' ? 'takeout' : 'uniform'
    const name = (body.name || body.storeName || '').trim() || (biz === 'takeout' ? 'テイクアウトメニュー' : '制服店メニュー')

    const richMenuId = await applyRichMenu(biz, name)
    return NextResponse.json({ ok: true, richMenuId, biz })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// DELETE?biz=uniform|takeout → 対象アカウントの全リッチメニュー削除
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const biz = (searchParams.get('biz') ?? 'uniform') as BizType
  const token = getLineToken(biz)
  const authHeader = { Authorization: `Bearer ${token}` }

  const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
  if (listRes.ok) {
    const { richmenus } = await listRes.json()
    await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
      fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
    ))
  }
  return NextResponse.json({ ok: true })
}
