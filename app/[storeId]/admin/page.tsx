'use client'

import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>管理テスト2</h1>
      <p>storeId: {storeId}</p>
      <p>supabase: {supabase ? 'OK' : 'NG'}</p>
    </div>
  )
}
