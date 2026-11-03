import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import appsNative from '../native/apps'

const INITIAL = {
  usageAccess: false,
  overlay: false,
  batteryOptimizationExempt: false,
  packageName: null,
}

export function usePermissions() {
  const [state, setState] = useState(INITIAL)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await appsNative.getPermissionState()
      setState({ ...INITIAL, ...(next ?? {}) })
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      refresh()
      const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') refresh() })
      return () => subscription.remove()
    }, [refresh]),
  )

  const grantUsage = useCallback(async () => {
    await appsNative.openUsageAccessSettings()
  }, [])

  const grantOverlay = useCallback(async () => {
    await appsNative.openOverlaySettings()
  }, [])

  const grantBattery = useCallback(async () => {
    await appsNative.requestBatteryOptimizationExemption()
  }, [])

  return {
    ...state,
    loading,
    refresh,
    grantUsage,
    grantOverlay,
    grantBattery,
  }
}

export default usePermissions
