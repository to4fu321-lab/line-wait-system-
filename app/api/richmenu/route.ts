export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import { createElement as h } from 'react'
import { getLiffBaseUrl, getLineToken } from '@/lib/line-config'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { resolveFeature } from '@/lib/features'
import { canCustomerOrder, canCustomerRepair } from '@/lib/customerFeatures'

const LINE_API  = 'https://api.line.me/v2/bot'

function getConfig() {
  const liffBase = getLiffBaseUrl('uniform')
  const liffId   = liffBase.replace('https://liff.line.me/', '')
  const token    = getLineToken('uniform')
  return { liffId, token, liffBase, authHeader: { Authorization: `Bearer ${token}` } }
}

const MENU_W = 2500
const MENU_H = 843

// リッチメニューの1パネル。絵と、そこをタップしたときの遷移先を1つにまとめる。
// 画像とタップ領域を同じ配列から作ることで、「押した場所と表示が違う」を防ぐ。
interface Panel {
  lines: string[]
  emoji: string
  bg: string
  label: string
  /** /line-home?action=... に渡す値。line-home 側の checkAvailability と対応する */
  action: string
}

/** パネル数に合わせて 2500px を割り振る（合計が必ず 2500 になるように丸める）*/
function panelBounds(count: number): { x: number; width: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const x    = Math.round((MENU_W * i) / count)
    const next = Math.round((MENU_W * (i + 1)) / count)
    return { x, width: next - x }
  })
}

async function makeMenuPng(panels: Panel[]): Promise<Buffer> {
  let fontData: ArrayBuffer | null = null
  try {
    const chars = encodeURIComponent(panels.flatMap(p => p.lines).join(''))
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${chars}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    ).then(r => r.text())
    const m = css.match(/src: url\((.+?)\) format/)
    if (m) fontData = await fetch(m[1]).then(r => r.arrayBuffer())
  } catch { /* フォント取得失敗時は続行 */ }

  const fontFamily = fontData ? '"Noto Sans JP", sans-serif' : 'sans-serif'
  const bounds = panelBounds(panels.length)

  const img = new ImageResponse(
    h('div', { style: { display: 'flex', width: MENU_W, height: MENU_H, fontFamily } },
      ...panels.map((s, i) =>
        h('div', {
          key: i,
          style: {
            width: bounds[i].width, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
            background: `linear-gradient(160deg, ${s.bg} 0%, ${s.bg}cc 100%)`,
            borderRight: i < panels.length - 1 ? '4px solid rgba(255,255,255,0.3)' : 'none',
          },
        },
          h('div', { style: { fontSize: 120, lineHeight: 1 } }, s.emoji),
          h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
            ...s.lines.map((line, j) =>
              h('div', {
                key: j,
                style: {
                  fontSize: panels.length >= 4 ? 85 : 96, fontWeight: 700, color: '#fff',
                  letterSpacing: '-1px', lineHeight: 1.15,
                },
              }, line)
            )
          )
        )
      )
    ),
    {
      width: MENU_W, height: MENU_H,
      fonts: fontData
        ? [{ name: 'Noto Sans JP', data: fontData, weight: 700, style: 'normal' as const }]
        : [],
    }
  )

  return Buffer.from(await img.arrayBuffer())
}

const PANEL_QUEUE:    Panel = { lines: ['採寸・受付'],            emoji: '📋', bg: '#4f46e5', label: '採寸・受付',       action: 'queue' }
const PANEL_RESERVE:  Panel = { lines: ['来店予約'],              emoji: '📅', bg: '#0d9488', label: '来店予約',         action: 'reserve' }
const PANEL_REPAIR:   Panel = { lines: ['お直し依頼'],            emoji: '✂️', bg: '#7c3aed', label: 'お直し依頼',       action: 'repair' }
const PANEL_PURCHASE: Panel = { lines: ['ネット注文'],            emoji: '🛍️', bg: '#db2777', label: 'ネット注文',       action: 'purchase' }
const PANEL_ORDER:    Panel = { lines: ['テイクアウト', '注文'],  emoji: '🥡', bg: '#ea580c', label: 'テイクアウト注文', action: 'order' }
// 提供機能が1つも無い場合でもメニューを空にはできないので、店舗ページへ送る
const PANEL_STORE:    Panel = { lines: ['店舗ページ'],            emoji: '🏠', bg: '#4f46e5', label: '店舗ページ',       action: '' }

/**
 * 店舗の業種と機能フラグから、実際に押せるパネルだけを組み立てる。
 * 判定は line-home 側の checkAvailability と揃えること（ここだけ緩いと
 * 「押せるのに “お取り扱いはありません” になる」ボタンが生まれる）。
 */
async function resolvePanels(storeId: string, storeTypeHint?: string): Promise<Panel[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('stores').select('business_type, features').eq('id', storeId).single()

  const bizType  = (data?.business_type as string | undefined) ?? storeTypeHint ?? 'uniform'
  const features = ((data?.features as Record<string, unknown> | null) ?? {})

  if (bizType === 'takeout') return [PANEL_ORDER, PANEL_QUEUE, PANEL_RESERVE, PANEL_REPAIR]

  const panels = [
    resolveFeature('tab_queue', features)   ? PANEL_QUEUE    : null,
    resolveFeature('reservation', features) ? PANEL_RESERVE  : null,
    canCustomerRepair(features)             ? PANEL_REPAIR   : null,
    canCustomerOrder(features)              ? PANEL_PURCHASE : null,
  ].filter((p): p is Panel => p !== null)

  return panels.length > 0 ? panels : [PANEL_STORE]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // ?debug=1 → 現在のリッチメニュー一覧と設定値を返す（更新しない）
  if (searchParams.get('debug') === '1') {
    const { liffBase, token, authHeader } = getConfig()
    const base = `${liffBase}/line-home`
    const previewUrls = {
      order:    `${base}?action=order`,
      queue:    `${base}?action=queue`,
      reserve:  `${base}?action=reserve`,
      repair:   `${base}?action=repair`,
      purchase: `${base}?action=purchase`,
    }
    const listRes = await fetch(`${LINE_API}/richmenu/list`, { headers: authHeader })
    const currentMenus = listRes.ok ? await listRes.json() : { error: await listRes.text() }
    // LIFF アプリ設定（エンドポイントURL確認用）
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

    // 2. その店舗が実際に提供している機能だけでパネルを組む。
    //    以前は全業種共通の固定4枚で、制服店にも「テイクアウト注文」が
    //    並んでいた（押すと必ず「お取り扱いはありません」）うえ、
    //    ネット注文のパネルがどこにも無く辿り着けなかった。
    const panels = await resolvePanels(storeId, storeType)
    const base   = `${liffBase}/line-home`
    const bounds = panelBounds(panels.length)
    const areas  = panels.map((p, i) => ({
      bounds: { x: bounds[i].x, y: 0, width: bounds[i].width, height: MENU_H },
      action: { type: 'uri', uri: `${base}?action=${p.action}`, label: p.label },
    }))
    const png = await makeMenuPng(panels)

    // 3. 新規メニュー作成
    const createRes = await fetch(`${LINE_API}/richmenu`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: { width: 2500, height: 843 }, selected: true, name, chatBarText: 'メニュー', areas }),
    })
    if (!createRes.ok) {
      const err = await createRes.text()
      return NextResponse.json({ ok: false, error: `create: ${err}`, debug: { liffId } }, { status: 500 })
    }
    const { richMenuId } = await createRes.json()

    // 4. 画像アップロード
    const imgRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'image/png' },
      body: png as unknown as BodyInit,
    })
    if (!imgRes.ok) console.warn('[richmenu] image upload:', await imgRes.text())

    // 5. 全ユーザーに適用
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
