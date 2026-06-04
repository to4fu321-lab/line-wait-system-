export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key)
}

export async function PATCH(req: Request) {
  try {
    const { storeId, isOpen } = await req.json()
    if (!storeId || typeof isOpen !== 'boolean') {
      return NextResponse.json({ error: 'storeId and isOpen required' }, { status: 400 })
    }
    const supabase = getSupabase()
    const { error, count } = await supabase
      .from('stores')
      .update({ is_open: isOpen }, { count: 'exact' })
      .eq('id', storeId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (count === 0) return NextResponse.json({ error: 'No rows updated (check RLS or storeId)' }, { status: 500 })

    // 実際に反映された値を返す
    const { data } = await supabase.from('stores').select('is_open').eq('id', storeId).single()
    return NextResponse.json({ ok: true, is_open: data?.is_open ?? isOpen })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
