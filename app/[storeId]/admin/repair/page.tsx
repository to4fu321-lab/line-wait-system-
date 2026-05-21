'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function RepairRedirect() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  useEffect(() => { router.replace(`/${storeId}/admin/crm`) }, [storeId, router])
  return null
}
