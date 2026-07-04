export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

export async function PATCH(req: Request) {
  try {
    const { storeId, themeColor } = await req.json()
    if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })
    const supabase = createAdminClient()
    const { error } = await supabase.from('stores').update({ theme_color: themeColor }).eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
