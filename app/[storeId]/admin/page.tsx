'use client'

import { useParams } from 'next/navigation'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'UNDEFINED'
const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'UNDEFINED').slice(0, 30)

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
      <h1>管理テスト8</h1>
      <p><b>URL:</b> {envUrl}</p>
      <p><b>KEY(30文字):</b> {envKey}</p>
    </div>
  )
}
