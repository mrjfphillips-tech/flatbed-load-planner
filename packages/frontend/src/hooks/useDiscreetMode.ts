/**
 * useDiscreetMode
 *
 * Manages discreet mode state, persisted to localStorage.
 * Single tap collapses UI to single-line status bar.
 *
 * Requirements: 10.5
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'ptv-discreet-mode'

export interface UseDiscreetModeReturn {
  isDiscreet: boolean
  toggle: () => void
  enable: () => void
  disable: () => void
}

export function useDiscreetMode(): UseDiscreetModeReturn {
  const [isDiscreet, setIsDiscreet] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isDiscreet))
    } catch {
      // localStorage unavailable — ignore
    }
  }, [isDiscreet])

  const toggle = useCallback(() => setIsDiscreet((v) => !v), [])
  const enable = useCallback(() => setIsDiscreet(true), [])
  const disable = useCallback(() => setIsDiscreet(false), [])

  return { isDiscreet, toggle, enable, disable }
}
