import deviceNative from '../native/device'
import appsNative from '../native/apps'
import { CAPABILITY, createEngine } from './base'
import { captureMetrics } from '../services/metrics'
import { probeLatency } from '../services/networkProbe'
import { metricsFromSnapshot, buildAlerts } from '../lib/insights'

export const deviceScanEngine = createEngine({
  id: 'device-scan',
  name: 'Device scan',
  category: 'performance',
  description: 'Reads the live hardware snapshot: CPU, memory, storage, battery and thermals.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const snapshot = await deviceNative.getSnapshot()
    if (!snapshot) return null
    const metrics = metricsFromSnapshot(snapshot)
    return {
      device: snapshot.device ?? null,
      cpu: snapshot.cpu ?? null,
      memory: snapshot.memory ?? null,
      storage: snapshot.storage ?? null,
      battery: snapshot.battery ?? null,
      alerts: buildAlerts(metrics),
    }
  },
})

export const fpsMonitorEngine = createEngine({
  id: 'fps-monitor',
  name: 'Frame rate probe',
  category: 'gaming',
  description: 'Measures Optinix Choreographer frame callbacks while this app is visible. This is not another game’s FPS; panel refresh rate is shown separately.',
  capability: CAPABILITY.MONITOR,
  measure: () => captureMetrics({ fps: true }),
  inspect: async () => {
    const [fps, snapshot] = await Promise.all([
      deviceNative.measureFps(1200),
      deviceNative.getSnapshot(),
    ])
    if (!fps) return null
    const refreshRate = snapshot?.display?.refreshRate ?? null
    const headroom = refreshRate != null ? Math.round((fps.fps / refreshRate) * 100) : null
    return {
      fps: fps.fps,
      frames: fps.frames,
      durationMs: fps.durationMs,
      refreshRate,
      headroomPercent: headroom,
    }
  },
})

export const thermalGuardEngine = createEngine({
  id: 'thermal-guard',
  name: 'Thermal guard',
  category: 'thermal',
  description:
    'Reads thermal zones and battery temperature. Android does not expose a public cooling API, so this engine reports instead of fabricating a fix.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const snapshot = await deviceNative.getSnapshot()
    if (!snapshot) return null
    const zones = Array.isArray(snapshot.thermal?.zones) ? snapshot.thermal.zones : []
    const sorted = [...zones].sort((a, b) => (b.celsius ?? 0) - (a.celsius ?? 0))
    return {
      hottestCelsius: snapshot.thermal?.celsius ?? null,
      status: snapshot.thermal?.statusLabel ?? 'unknown',
      batteryCelsius: snapshot.battery?.temperatureC ?? null,
      topZones: sorted.slice(0, 5),
      zoneCount: zones.length,
    }
  },
  execute: async () => ({
    ok: false,
    supported: false,
    reason: 'no-public-thermal-control',
    message: 'No public Android API can lower device temperature. Reduce load instead.',
  }),
})

export const batteryAuditEngine = createEngine({
  id: 'battery-audit',
  name: 'Battery audit',
  category: 'battery',
  description: 'Reports charge state and battery temperature, and can request optimisation exemption.',
  capability: CAPABILITY.SETTINGS,
  inspect: async () => {
    const [snapshot, permissions] = await Promise.all([
      deviceNative.getSnapshot(),
      appsNative.getPermissionState(),
    ])
    if (!snapshot) return null
    return {
      percent: snapshot.battery?.percent ?? null,
      status: snapshot.battery?.status ?? 'unknown',
      temperatureC: snapshot.battery?.temperatureC ?? null,
      voltageMv: snapshot.battery?.voltageMv ?? null,
      currentUa: snapshot.battery?.currentUa ?? null,
      health: snapshot.battery?.health ?? 'unknown',
      technology: snapshot.battery?.technology ?? null,
      optimizationExempt: permissions?.batteryOptimizationExempt ?? false,
    }
  },
  execute: async () => {
    const opened = await appsNative.requestBatteryOptimizationExemption()
    return {
      ok: Boolean(opened),
      supported: true,
      actions: [{ type: 'open-settings', target: 'battery-optimization', opened: Boolean(opened) }],
      note: 'Android requires the user to confirm this dialog.',
    }
  },
})

export const networkDiagnoseEngine = createEngine({
  id: 'network-diagnose',
  name: 'Network diagnose',
  category: 'network',
  description: 'Measures HTTPS round-trip latency and jitter, and reports the active transport.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const [latency, snapshot] = await Promise.all([
      probeLatency({ samples: 3, timeoutMs: 2500 }),
      deviceNative.getSnapshot(),
    ])
    if (!latency && !snapshot?.network) return null
    return {
      latency,
      type: snapshot?.network?.type ?? 'unknown',
      validated: snapshot?.network?.validated ?? null,
      metered: snapshot?.network?.metered ?? null,
      rssi: snapshot?.network?.rssi ?? null,
      linkSpeedMbps: snapshot?.network?.linkSpeedMbps ?? null,
      downKbps: snapshot?.network?.downKbps ?? null,
    }
  },
  execute: async () => ({
    ok: false,
    supported: false,
    reason: 'no-public-network-control',
    message: 'Android apps cannot rewrite Wi-Fi or DNS settings without user-owned VPN or root.',
  }),
})

export const storageAuditEngine = createEngine({
  id: 'storage-audit',
  name: 'Storage audit',
  category: 'storage',
  description: 'Breaks down internal storage and ranks installed apps by reported on-disk usage.',
  capability: CAPABILITY.MONITOR,
  inspect: async () => {
    const snapshot = await deviceNative.getSnapshot()
    const apps = await appsNative.getInstalledApps(false)
    const top = (apps ?? []).slice(0, 40).map((app) => app.packageName)
    const stats = await appsNative.getStorageStats(top)
    const supported = (stats ?? []).filter((entry) => entry.supported)
    const ranked = supported
      .map((entry) => {
        const app = (apps ?? []).find((candidate) => candidate.packageName === entry.packageName)
        return { ...entry, label: app?.label ?? entry.packageName }
      })
      .sort((a, b) => (b.totalBytes ?? 0) - (a.totalBytes ?? 0))
      .slice(0, 10)

    return {
      storage: snapshot?.storage ?? null,
      rankedApps: ranked,
      measuredApps: supported.length,
      candidateApps: (stats ?? []).length,
    }
  },
})
