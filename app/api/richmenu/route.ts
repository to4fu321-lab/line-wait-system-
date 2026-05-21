import { NextRequest, NextResponse } from 'next/server'
import zlib from 'zlib'
import { promisify } from 'util'

const deflate = promisify(zlib.deflate)

const STORE_ID  = process.env.STORE_ID || '00000000-0000-0000-0000-000000000010'
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  'VCdCDq+VcStiwPWbk3nzK59dV1MylArXtvMETswJlGy3IwikR3WNJGk1br86YnzKGqBpHp0kIQbRDaDSPzMphck0TKHwy6MDHW4U2UzbZaYU0Uq+QxhI2pp90x13qHxd8PdgqIIBoq2xq8hFaPXAOQdB04t89/1O/w1cDnyilFU='
const LIFF_BASE = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'}`
const LINE_API  = 'https://api.line.me/v2/bot'
const authHeader = { Authorization: `Bearer ${TOKEN}` }

// ── PNG生成（純Node.js、外部ライブラリ不要）──────────────
function crc32(buf: Buffer): number {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const tb  = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([len, tb, data, crcBuf])
}

async function makeMenuPng(): Promise<Buffer> {
  const W = 2500, H = 843
  const sections = [
    { from: 0,    to: 833,  r: 79,  g: 70,  b: 229 }, // indigo  順番待ち
    { from: 833,  to: 1667, r: 124, g: 58,  b: 237 }, // violet  お直し
    { from: 1667, to: 2500, r: 37,  g: 99,  b: 235 }, // blue    取り置き
  ]

  const raw = Buffer.alloc(H * (1 + W * 3))
  for (let y = 0; y < H; y++) {
    const base = y * (1 + W * 3)
    raw[base] = 0 // filter: None
    for (let x = 0; x < W; x++) {
      const s = sections.find(s => x >= s.from && x < s.to)!
      const p = base + 1 + x * 3
      // 上下に薄いグラデーション
      const shade = 1 - (y / H) * 0.25
      raw[p]     = Math.round(s.r * shade)
      raw[p + 1] = Math.round(s.g * shade)
      raw[p + 2] = Math.round(s.b * shade)
    }
    // 区切り線（白）
    const dividers = [833, 1667]
    for (const dx of dividers) {
      for (let d = -2; d <= 2; d++) {
        const x = dx + d
        if (x >= 0 && x < W) {
          const p = base + 1 + x * 3
          raw[p] = raw[p + 1] = raw[p + 2] = 255
        }
      }
    }
  }

  const compressed = await deflate(raw)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8bit RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
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
          { bounds: { x: 0,    y: 0, width: 833,  height: 843 }, action: { type: 'uri', uri: `${base}?action=queue`,    label: '順番待ち' } },
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
      body: png,
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
