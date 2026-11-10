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
  clearOwnCache() {
    return safeCall('clearOwnCache', { ok: false, supported: false, freedBytes: null, message: 'Cache cleaning is unavailable in this build.' })
  },
  openApp(packageName) {
    return safeCall('openApp', false, packageName)
  },
  openAppInfo(packageName) {
    return safeCall('openAppInfo', false, packageName)
  },
  openAppManagementSettings() {
    return safeCall('openAppManagementSettings', false)
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
  // Startup (auto-start) capability: supported is true only when a vendor
  // auto-start manager actually resolved on this device.
  getStartupSupport() {
    return safeCall('getStartupSupport', { supported: false, manufacturer: null, managerLabel: null, packageName: null })
  },
  openAutoStartSettings() {
    return safeCall('openAutoStartSettings', { ok: false, supported: false, message: 'Startup controls are unavailable in this build.' })
  },
}

export default appsNative
