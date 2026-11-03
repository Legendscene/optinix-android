import NativeDevice, { isAvailable } from '../../modules/optinix-device'

export const isDeviceNativeAvailable = isAvailable

const EMPTY = null

async function safeCall(method, ...args) {
  if (!NativeDevice) return EMPTY
  try {
    const result = await NativeDevice[method](...args)
    return result ?? EMPTY
  } catch {
    return EMPTY
  }
}

export const deviceNative = {
  get isAvailable() {
    return isAvailable
  },
  getSnapshot() {
    return safeCall('getSnapshot')
  },
  getCpuLoad() {
    return safeCall('getCpuLoad')
  },
  measureFps(durationMs = 1000) {
    return safeCall('getFps', durationMs)
  },
}

export default deviceNative
