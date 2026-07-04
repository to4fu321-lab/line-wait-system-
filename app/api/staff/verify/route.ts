export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'

// ============================================================
// スタッフPIN照合(スタッフportalログイン)
//   クライアントで eq('pin',...) を晒さず、service-role で照合。
//   一致時のみ最小限のスタッフ情報を返す。
// ============================================================

export async function POST(req: Request) {
  try {
    const { storeId, pin } = await req.json()
    if (!storeId || !pin || String(pin).length < 4) {
      return NextResponse.json({ error: 'PINを入力してください' }, { status: 400 })
    }
    const supabase = createAdminClient()

    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, name, kana, role, color, store_id')
      .eq('store_id', storeId)
      .eq('pin', String(pin))
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (error || !staff) {
      // 列挙対策で曖昧なエラー
      return NextResponse.json({ error: 'PINが違います' }, { status: 401 })
    }

    return NextResponse.json({
      staff: {
        id:    (staff as any).id,
        name:  (staff as any).name,
        kana:  (staff as any).kana,
        role:  (staff as any).role,
        color: (staff as any).color,
        store_id: (staff as any).store_id,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
