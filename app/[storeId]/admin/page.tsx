'use client'

import { useParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const client = createClient(
  'https://placeholder.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder'
)

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>管理テスト7</h1>
      <p>storeId: {storeId}</p>
      <p>client: {client ? 'OK' : 'NG'}</p>
    </div>
  )
}
