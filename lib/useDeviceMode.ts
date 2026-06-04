'use client'

import { createContext, useContext } from 'react'

export type DeviceMode = 'tablet' | 'phone'

export interface DeviceModeContextValue {
  mode: DeviceMode
  setMode: (m: DeviceMode) => void
  isTablet: boolean
  isPhone: boolean
}

export const DeviceModeContext = createContext<DeviceModeContextValue>({
  mode: 'phone',
  setMode: () => {},
  isTablet: false,
  isPhone: true,
})

export function useDeviceMode() {
  return useContext(DeviceModeContext)
}
