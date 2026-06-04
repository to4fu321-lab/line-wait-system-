'use client'

import { useState, useEffect, ReactNode } from 'react'
import { DeviceModeContext, DeviceMode } from '@/lib/useDeviceMode'

const STORAGE_KEY = 'admin_device_mode'

function detectDefault(): DeviceMode {
  if (typeof window === 'undefined') return 'phone'
  const stored = localStorage.getItem(STORAGE_KEY) as DeviceMode | null
  if (stored === 'tablet' || stored === 'phone') return stored
  // Auto-detect: tablet if width >= 768px
  return window.innerWidth >= 768 ? 'tablet' : 'phone'
}

export function DeviceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DeviceMode>('phone')

  useEffect(() => {
    setModeState(detectDefault())
  }, [])

  function setMode(m: DeviceMode) {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
  }

  return (
    <DeviceModeContext.Provider value={{ mode, setMode, isTablet: mode === 'tablet', isPhone: mode === 'phone' }}>
      {children}
    </DeviceModeContext.Provider>
  )
}
