'use client'

import { useParams } from 'next/navigation'

export default function CustomerPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>テスト表示</h1>
      <p>storeId: {storeId}</p>
    </div>
  )
}
