import { requireNativeModule } from 'expo-modules-core'

let nativeModule = null
try {
  nativeModule = requireNativeModule('OptinixOverlay')
} catch {
  nativeModule = null
}

export const isAvailable = nativeModule != null

export default nativeModule
