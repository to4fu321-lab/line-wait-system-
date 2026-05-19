'use client'

import { useParams } from 'next/navigation'
import { _diagnostics } from '@/lib/supabase'

export default function AdminPage() {
  const { storeId } = useParams<{ storeId: string }>()
  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', lineHeight: 2 }}>
      <h1 style={{ fontFamily: 'sans-serif', fontSize: 20 }}>管理テスト9 — 環境変数診断</h1>
      <p><b>storeId:</b> {storeId}</p>
      <hr />
      <p><b>SUPABASE_URL (raw):</b> {_diagnostics.rawUrl || '(空)'}</p>
      <p><b>SUPABASE_URL (parsed origin):</b> {_diagnostics.parsedUrl || '(空)'}</p>
      <p><b>ANON_KEY 長さ:</b> {_diagnostics.keyLength} 文字</p>
      <p><b>ANON_KEY 先頭20文字:</b> {_diagnostics.keyPrefix || '(空)'}</p>
    </div>
  )
}
