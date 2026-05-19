'use client'

import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>管理テスト3</h1>
      <p>storeId: {storeId}</p>
      <Loader2 size={24} />
    </div>
  )
}
