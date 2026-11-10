import appsNative from '../native/apps'
import deviceNative from '../native/device'
import overlayNative from '../native/overlay'
import { CAPABILITY, createEngine } from './base'

export function pickBoostCandidates(recentApps, { limit = 12, exclude = [] } = {}) {
  const excluded = new Set(exclude.filter(Boolean))
  return (recentApps ?? []).filter((app) => app && typeof app.packageName === 'string' && !app.isSystem && !excluded.has(app.packageName))
    .sort((a, b) => (b.totalTimeInForegroundMs ?? 0) - (a.totalTimeInForegroundMs ?? 0)).slice(0, limit)
}

export function pickStorageHogs(stats, { limit = 8 } = {}) {
  return (stats ?? []).filter((entry) => entry?.supported && typeof entry.totalBytes === 'number').sort((a, b) => b.totalBytes - a.totalBytes).slice(0, limit)
}

export const memoryBoostEngine = createEngine({
  id: 'memory-boost', name: 'Memory review', category: 'performance',
  description: 'Reads available RAM and memory pressure. Android manages cached processes; Optinix does not force-stop unrelated apps.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const snapshot = await deviceNative.getSnapshot()
    return snapshot?.memory ?? null
  },
})

export const cacheCleanEngine = createEngine({
  id: 'cache-clean', name: 'Optinix cache cleaner', category: 'storage',
  description: 'Deletes only Optinix cache files. Reports bytes from successful deletions; other apps use their own storage settings.',
  capability: CAPABILITY.APPLY,
  inspect: async () => {
    const permissions = await appsNative.getPermissionState()
    const ownPackage = permissions?.packageName
    const stats = ownPackage ? await appsNative.getStorageStats([ownPackage]) : []
    return { ownPackage, cacheBytes: stats?.[0]?.cacheBytes ?? null, measured: stats?.[0]?.supported === true }
  },
  execute: async () => {
    const result = await appsNative.clearOwnCache()
    return {
      ok: result?.ok !== false && result?.freedBytes != null,
      supported: result?.supported !== false,
      freedBytes: result?.freedBytes ?? null,
      actions: [{ type: 'clear-cache', scope: 'own-app', freedBytes: result?.freedBytes ?? null }],
      message: result?.message,
      note: 'Only successfully deleted Optinix cache files are counted. No game FPS improvement is inferred.',
    }
  },
})

export const appUsageEngine = createEngine({
  id: 'app-usage', name: 'Recent app usage', category: 'performance',
  description: 'Shows foreground time for visible recently used apps with optional Usage Access. Foreground time is not evidence of background CPU use.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const permissions = await appsNative.getPermissionState()
    return { usageAccess: permissions?.usageAccess ?? false, apps: permissions?.usageAccess ? await appsNative.getRecentApps(12) : [] }
  },
})

export const gameBoostEngine = createEngine({
  id: 'game-boost', name: 'Gaming setup', category: 'gaming',
  description: 'Checks available gaming access and can start the native HUD. Per-game profiles are configured in Game Space.',
  capability: CAPABILITY.APPLY,
  inspect: async () => {
    const [permissions, overlayState] = await Promise.all([appsNative.getPermissionState(), overlayNative.getState()])
    return { usageAccess: permissions?.usageAccess ?? false, overlayPermission: overlayState?.hasPermission ?? false }
  },
  /** Mono dark ink fallback; the HUD panel is always dark and BoostScreen
   *  passes the live theme accent, so this only covers direct calls. */
  execute: async ({ inspection, startOverlay = false, accent = '#ffffff' }) => {
    if (!startOverlay) return { ok: false, supported: true, message: 'Enable the optional HUD in Settings, or configure a game profile in Game Space.', note: 'No hardware or background processes changed.' }
    if (!inspection?.overlayPermission) return { ok: false, supported: true, reason: 'permission', message: 'Enable display-over-apps access in Gaming tools to start the HUD.' }
    const started = await overlayNative.start({ accent })
    return { ok: started === true, supported: true, actions: [{ type: 'start-overlay', ok: started === true }], message: started ? 'HUD started. No game FPS improvement is claimed.' : 'Android could not start the HUD. Open Gaming tools for permission status.' }
  },
})
