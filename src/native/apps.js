import NativeApps, { isAvailable } from '../../modules/optinix-apps'

export const isAppsNativeAvailable = isAvailable

async function safeCall(method, fallback, ...args) {
  if (!NativeApps) return fallback
  try {
    const result = await NativeApps[method](...args)
    return result ?? fallback
  } catch {
    return fallback
  }
}

export const appsNative = {
  get isAvailable() {
    return isAvailable
  },
  getInstalledApps(includeSystem = false) {
    return safeCall('getInstalledApps', [], includeSystem)
  },
  getGameCandidates() {
    return safeCall('getGameCandidates', [])
  },
  getAppIcon(packageName, sizePx = 96) {
    return safeCall('getAppIcon', null, packageName, sizePx)
  },
  getForegroundApp() {
    return safeCall('getForegroundApp', null)
  },
  getRecentApps(hours = 6) {
    return safeCall('getRecentApps', [], hours)
  },
  getStorageStats(packageNames = []) {
    return safeCall('getStorageStats', [], packageNames)
  },
  boost(packageNames = []) {
    return safeCall('boost', { ok: false, supported: false, requested: 0, killed: null }, packageNames)
  },
  clearOwnCache() {
    return safeCall('clearOwnCache', { ok: false, supported: false, freedBytes: null, message: 'Cache cleaning is unavailable in this build.' })
  },
  openApp(packageName) {
    return safeCall('openApp', false, packageName)
  },
  openAppInfo(packageName) {
    return safeCall('openAppInfo', false, packageName)
  },
  hasUsageAccess() {
    return safeCall('hasUsageAccess', false)
  },
  openUsageAccessSettings() {
    return safeCall('openUsageAccessSettings', false)
  },
  hasOverlayPermission() {
    return safeCall('hasOverlayPermission', false)
  },
  openOverlaySettings() {
    return safeCall('openOverlaySettings', false)
  },
  hasBatteryOptimizationExemption() {
    return safeCall('hasBatteryOptimizationExemption', false)
  },
  requestBatteryOptimizationExemption() {
    return safeCall('requestBatteryOptimizationExemption', false)
  },
  getPermissionState() {
    return safeCall('getPermissionState', {
      usageAccess: false,
      overlay: false,
      batteryOptimizationExempt: false,
      packageName: null,
    })
  },
}

export default appsNative
