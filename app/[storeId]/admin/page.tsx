'use client'

import { useParams } from 'next/navigation'

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>管理テスト10 - supabase fix</h1>
      <p>storeId: {storeId}</p>
    </div>
  )
}
