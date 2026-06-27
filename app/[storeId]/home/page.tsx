'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// LIFF SDK calls history.replaceState after init, turning /line-home into
// /{endpoint_storeId}/line-home. We intercept here and send back to /line-home
// so the routing hub handles store selection correctly.
export default function HomeRedirect() {
  const router = useRouter()
  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get('action')
    router.replace(action ? `/line-home?action=${encodeURIComponent(action)}` : '/line-home')
  }, [router])
  return null
}
