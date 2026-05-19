'use client'

import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>管理テスト5</h1>
      <p>storeId: {storeId}</p>
      <p>createClient型: {typeof createClient}</p>
    </div>
  )
}
