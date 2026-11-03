import NativeOverlay, { isAvailable } from '../../modules/optinix-overlay'

export const isOverlayNativeAvailable = isAvailable

async function safeCall(method, fallback, ...args) {
  if (!NativeOverlay) return fallback
  try {
    const result = await NativeOverlay[method](...args)
    return result ?? fallback
  } catch {
    return fallback
  }
}

export const overlayNative = {
  get isAvailable() {
    return isAvailable
  },
  hasPermission() {
    return safeCall('hasPermission', false)
  },
  requestPermission() {
    return safeCall('requestPermission', false)
  },
  start(config = {}) {
    return safeCall('start', false, config)
  },
  setConfig(config = {}) {
    return safeCall('setConfig', false, config)
  },
  stop() {
    return safeCall('stop', false)
  },
  getState() {
    return safeCall('getState', { showing: false, expanded: false, hasPermission: false })
  },
}

export default overlayNative
