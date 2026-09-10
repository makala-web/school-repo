'use client'

import { useState, useEffect } from 'react'

export interface MobileState {
  isMobile: boolean
  isInitialized: boolean
  error: string | null
}

export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>({
    isMobile: false,
    isInitialized: false,
    error: null
  })

  useEffect(() => {
    // Web-only: always mark as initialized and not mobile
    setState({
      isMobile: false,
      isInitialized: true,
      error: null
    })
  }, [])

  return state
}
