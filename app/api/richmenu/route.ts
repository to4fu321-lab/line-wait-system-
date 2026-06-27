export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'

const LINE_API  = 'https://api.line.me/v2/bot'

// キャンバスサイズ定数（2×3グリッド用）
const W        = 2500
const H        = 1686
const HEADER_H = 300
const ROW_H    = 462   // (1686 - 300) / 3 = 462 ぴったり
const COL_W    = 1250  // 2500 / 2

function getConfig() {
  const liffBase = getLiffBaseUrl('uniform')
  const liffId   = liffBase.replace('https://liff.line.me/', '')
  const token    = getLineToken('uniform')
  return { liffId, token, liffBase, authHeader: { Authorization: `Bearer ${token}` } }
}

// ── 制服店用リッチメニュー画像（6パネル・2列×3行）────────────
async function makeMenuPng(): Promise<Buffer> {
  let fontData: ArrayBuffer | null = null
  try {
    const chars = encodeURIComponent(
      'テイクアウト注文店舗受付制服予約お問い合わせサイズガイドアクセス' +
      'お持ち帰りのご注文はこちらご来店ご予約採寸ご質問サイズの測り方店舗の場所' +
      'MENUGUIDEガイド学生服販売店'
    )
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&text=${chars}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) fontData = await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }

  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'

  const BG         = '#A89880'  // ウォームタウプ
  const TITLE_COL  = '#4A3428'  // ダークブラウン
  const SUB_COL    = '#7A6050'  // ミディアムブラウン

  const panels = [
    { emoji: '🛍️', title: 'テイクアウト注文' },
    { emoji: '🏪',  title: '店舗・受付' },
    { emoji: '🧥',  title: '制服予約' },
    { emoji: '✉️',  title: 'お問い合わせ' },
    { emoji: '📏',  title: 'サイズガイド' },
    { emoji: '📍',  title: 'アクセス' },
  ]

  function cell(p: typeof panels[0], key: number) {
    return h('div', {
      key,
      style: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        width: COL_W, height: ROW_H, gap: 16,
      },
    },
      h('div', { style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 200, height: 200, borderRadius: '50%', background: '#FFFFFF',
        fontSize: 110, lineHeight: 1,
      }}, p.emoji),
      h('div', { style: { fontSize: 150, fontWeight: 700, color: TITLE_COL, letterSpacing: '-2px', lineHeight: 1 } }, p.title),
    )
  }

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', flexDirection: 'column', width: W, height: H, background: BG, fontFamily } },
      // ヘッダー
      h('div', { style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: HEADER_H,
      }},
        h('div', { style: { fontSize: 104, fontWeight: 700, color: '#FFFFFF', letterSpacing: '14px', lineHeight: 1 } }, 'MENU GUIDE'),
        h('div', { style: { width: 80, height: 3, background: '#FFFFFF80', margin: '18px 0 16px' } }),
        h('div', { style: { fontSize: 50, fontWeight: 400, color: '#FFFFFF', letterSpacing: '12px' } }, '学生服販売店'),
      ),
      // 3行 × 2列グリッド
      ...[0, 1, 2].map(row =>
        h('div', { key: row, style: { display: 'flex', width: W, height: ROW_H } },
          cell(panels[row * 2],     row * 2),
          cell(panels[row * 2 + 1], row * 2 + 1),
        )
      ),
    ),
    {
      width: W,
      height: H,
      fonts: fontData
        ? [{ name: 'Noto Sans JP', data: fontData, weight: 700, style: 'normal' as const }]
        : [],
    }
  )

  return Buffer.from(await img.arrayBuffer())
}

// ── テイクアウト用リッチメニュー画像（2パネル）──────────────
async function makeMenuPngTakeout(storeName: string): Promise<Buffer> {
  let fontData: ArrayBuffer | null = null
  try {
    const chars = encodeURIComponent('注文する状況を確認' + storeName)
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${chars}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) fontData = await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }

  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'
  const sections = [
    { lines: ['注文する'],      emoji: '🛍️', bg: '#ea580c' },
    { lines: ['注文状況を確認'], emoji: '📋', bg: '#0d9488' },
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
          h('div', { style: { fontSize: 96, fontWeight: 700, color: '#fff', letterSpacing: '-1px' } }, s.lines[0])
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


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ?debug=1 → 現在のリッチメニュー一覧と設定値を返す（更新しない）
  if (searchParams.get('debug') === '1') {
    const { liffBase, token, authHeader } = getConfig()
    const base = `${liffBase}/line-home`
    const previewUrls = {
      order:   `${base}?action=order`,
      queue:   `${base}?action=queue`,
      reserve: `${base}?action=reserve`,
      inquiry: `${base}?action=inquiry`,
      size:    `${base}?action=size`,
      access:  `${base}?action=access`,
    }
    const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
    const currentMenus = listRes.ok ? await listRes.json() : { error: await listRes.text() }
    const liffRes = await fetch('https://api.line.me/liff/v1/apps', { headers: authHeader })
    const liffApps = liffRes.ok ? await liffRes.json() : { error: await liffRes.text() }
    return NextResponse.json({
      config: { liffBase, hasToken: !!token },
      previewUrls,
      currentMenus,
      liffApps,
    })
  }

  const storeId   = searchParams.get('storeId')   ?? ''
  const storeName = searchParams.get('storeName')  ?? ''
  const fakeReq = { json: async () => ({ storeId, storeName }) } as unknown as NextRequest
  return POST(fakeReq)
}

// POST { storeId, storeName, storeType? } → リッチメニュー作成・全ユーザー適用
export async function POST(req: NextRequest) {
  try {
    const { storeId, storeName, storeType } = await req.json()
    if (!storeId) return NextResponse.json({ ok: false, error: 'storeId required' }, { status: 400 })

    const { liffId, token, liffBase, authHeader } = getConfig()

    if (!liffBase) {
      return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_LIFF_ID が未設定です。Vercel の環境変数を確認してください。' }, { status: 500 })
    }
    if (!token) {
      return NextResponse.json({ ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です。Vercel の環境変数を確認してください。' }, { status: 500 })
    }

    const name = (storeName || '').trim() || 'メニュー'

    // 1. 既存メニューを全削除
    const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
    if (listRes.ok) {
      const { richmenus } = await listRes.json()
      await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
        fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
      ))
    }

    const base = `${liffBase}/line-home`

    let png: Buffer
    let menuSize: { width: number; height: number }
    let areas: object[]

    if (storeType === 'takeout') {
      // テイクアウト店：2パネル横型（2500×843）
      png = await makeMenuPngTakeout(name)
      menuSize = { width: 2500, height: 843 }
      areas = [
        { bounds: { x:    0, y: 0, width: 1250, height: 843 }, action: { type: 'uri', uri: `${base}?action=order`, label: '注文する' } },
        { bounds: { x: 1250, y: 0, width: 1250, height: 843 }, action: { type: 'uri', uri: `${base}?action=queue`, label: '注文状況を確認' } },
      ]
    } else {
      // 制服店：6パネル 2×3グリッド（2500×1686）
      png = await makeMenuPng()
      menuSize = { width: W, height: H }
      areas = [
        { bounds: { x: 0,     y: HEADER_H,              width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=order`,   label: 'テイクアウト注文' } },
        { bounds: { x: COL_W, y: HEADER_H,              width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=queue`,   label: '店舗・受付' } },
        { bounds: { x: 0,     y: HEADER_H + ROW_H,      width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=reserve`, label: '制服予約' } },
        { bounds: { x: COL_W, y: HEADER_H + ROW_H,      width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=inquiry`, label: 'お問い合わせ' } },
        { bounds: { x: 0,     y: HEADER_H + ROW_H * 2,  width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=size`,    label: 'サイズガイド' } },
        { bounds: { x: COL_W, y: HEADER_H + ROW_H * 2,  width: COL_W, height: ROW_H }, action: { type: 'uri', uri: `${base}?action=access`,  label: 'アクセス' } },
      ]
    }

    // 2. 新規メニュー作成
    const createRes = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: menuSize, selected: true, name, chatBarText: 'メニュー', areas }),
    })
    if (!createRes.ok) {
      const err = await createRes.text()
      return NextResponse.json({ ok: false, error: `create: ${err}`, debug: { liffId } }, { status: 500 })
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

    return NextResponse.json({ ok: true, richMenuId })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// DELETE → 全リッチメニュー削除
export async function DELETE() {
  const { authHeader } = getConfig()
  const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
  if (listRes.ok) {
    const { richmenus } = await listRes.json()
    await Promise.all((richmenus ?? []).map((m: { richMenuId: string }) =>
      fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: 'DELETE', headers: authHeader })
    ))
  }
  return NextResponse.json({ ok: true })
}
