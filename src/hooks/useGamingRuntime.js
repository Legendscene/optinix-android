import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import gamingNative from '../native/gaming'
import adManager from '../services/adManager'

export function useGamingRuntime() {
  const [runtime, setRuntime] = useState({ running: false, session: null, macro: null, capture: null })
  const [capabilities, setCapabilities] = useState({})
  const refresh = useCallback(async () => {
    const [next, access] = await Promise.all([gamingNative.getRuntime(), gamingNative.getCapabilities()])
    setRuntime(next)
    setCapabilities(access)
    adManager.setGamingActive(Boolean(next?.running))
  }, [])
  useFocusEffect(useCallback(() => {
    let alive = true
    let timer
    let busy = false
    const sample = async () => {
      if (!alive || AppState.currentState !== 'active' || busy) return
      busy = true
      const [next, access] = await Promise.all([gamingNative.getRuntime(), gamingNative.getCapabilities()])
      busy = false
      if (alive) {
        setRuntime(next)
        setCapabilities(access)
        adManager.setGamingActive(Boolean(next?.running))
        timer = setTimeout(sample, 2000)
      }
    }
    const sub = AppState.addEventListener('change', (state) => {
      clearTimeout(timer)
      if (state === 'active') sample()
    })
    sample()
    return () => { alive = false; clearTimeout(timer); sub.remove() }
  }, []))
  return { runtime, capabilities, refresh }
}
