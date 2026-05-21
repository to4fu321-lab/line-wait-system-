'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function OnboardingRedirect() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  useEffect(() => { router.replace(`/${storeId}`) }, [storeId, router])
  return null
}
