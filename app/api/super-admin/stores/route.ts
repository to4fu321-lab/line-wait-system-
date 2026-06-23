export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { assertSuperAdmin } from '@/lib/auth/verifyAdmin'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function POST(req: Request) {
  const denied = assertSuperAdmin(req)
  if (denied) return denied
  try {
    const { storeName, storePin, businessType, groupId, newGroupName, newGroupCode, newGroupPin } = await req.json()

    if (!storeName?.trim()) {
      return NextResponse.json({ error: '店舗名は必須です' }, { status: 400 })
    }

    const supabase = getSupabase()
    let finalGroupId: string | null = groupId || null

    // 新規会社を作成（URLコードは任意・空欄可。groups.code は null 許容）
    if (!finalGroupId && newGroupName?.trim()) {
      const { data: newGroup, error: groupErr } = await supabase
        .from('groups')
        .insert({ name: newGroupName.trim(), code: newGroupCode?.trim() || null, pin: newGroupPin || '0000' })
        .select().single()
      if (groupErr) return NextResponse.json({ error: groupErr.message }, { status: 500 })
      finalGroupId = newGroup.id
    }

    // 店舗を作成
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .insert({ name: storeName.trim(), pin: storePin || '0000', group_id: finalGroupId, business_type: businessType || 'uniform' })
      .select().single()

    if (storeErr) return NextResponse.json({ error: storeErr.message }, { status: 500 })

    return NextResponse.json({ store })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
