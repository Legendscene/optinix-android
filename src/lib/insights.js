import { thresholds } from './designTokens'

const WEIGHTS = {
  cpu: 32,
  ram: 28,
  thermal: 18,
  storage: 12,
  battery: 10,
}

export const CRITICAL = {
  cpu: 95,
  ram: 95,
  temperature: 58,
  batteryTemp: 52,
  storage: 97,
  ping: 150,
}

export function computeHealth(metrics) {
  if (!metrics) return null

  const parts = []

  if (metrics.cpuPercent != null) {
    parts.push({ key: 'cpu', weight: WEIGHTS.cpu, load: normalize(metrics.cpuPercent, 45, 95) })
  }
  if (metrics.ramPercent != null) {
    parts.push({ key: 'ram', weight: WEIGHTS.ram, load: normalize(metrics.ramPercent, 55, 95) })
  }
  if (metrics.temperatureC != null) {
    parts.push({
      key: 'thermal',
      weight: WEIGHTS.thermal,
      load: normalize(metrics.temperatureC, 38, 62),
    })
  }
  if (metrics.storagePercent != null) {
    parts.push({
      key: 'storage',
      weight: WEIGHTS.storage,
      load: normalize(metrics.storagePercent, 78, 98),
    })
  }
  if (metrics.batteryPercent != null && metrics.batteryStatus === 'discharging') {
    parts.push({
      key: 'battery',
      weight: WEIGHTS.battery,
      load: normalize(20 - metrics.batteryPercent, 0, 20),
    })
  }

  if (parts.length === 0) return null

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0)
  const penalty = parts.reduce((sum, part) => sum + part.load * part.weight, 0) / totalWeight
  const score = Math.round(clamp(100 - penalty * 100, 0, 100))

  return {
    score,
    grade: healthGrade(score),
    penalties: parts.map((part) => ({
      key: part.key,
      load: Math.round(part.load * 100),
    })),
  }
}

export function healthGrade(score) {
  if (score == null) return 'unknown'
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'poor'
}

export function pingQuality(pingMs) {
  if (pingMs == null) return 'unknown'
  if (pingMs <= thresholds.ping.good) return 'good'
  if (pingMs <= thresholds.ping.warn) return 'fair'
  return 'poor'
}

export function statusFromScore(score) {
  if (score == null) return 'unknown'
  if (score >= 85) return 'good'
  if (score >= 60) return 'warn'
  return 'poor'
}

export function buildAlerts(metrics) {
  if (!metrics) return []
  const alerts = []

  if (metrics.cpuPercent != null && metrics.cpuPercent >= thresholds.cpu.warn) {
    alerts.push({
      id: 'cpu',
      severity: metrics.cpuPercent >= CRITICAL.cpu ? 'critical' : 'warning',
      title: 'CPU load is high',
      detail: `${Math.round(metrics.cpuPercent)}% of CPU cycles are busy`,
    })
  }

  if (metrics.ramPercent != null && metrics.ramPercent >= thresholds.ram.warn) {
    alerts.push({
      id: 'ram',
      severity: metrics.ramPercent >= CRITICAL.ram ? 'critical' : 'warning',
      title: 'Memory pressure rising',
      detail: `${Math.round(metrics.ramPercent)}% of RAM in use`,
    })
  }

  if (metrics.temperatureC != null && metrics.temperatureC >= thresholds.temperature.warn) {
    alerts.push({
      id: 'thermal',
      severity: metrics.temperatureC >= CRITICAL.temperature ? 'critical' : 'warning',
      title: 'Device is heating up',
      detail: `${metrics.temperatureC.toFixed(1)}°C thermal reading`,
    })
  }

  if (metrics.batteryTemperatureC != null && metrics.batteryTemperatureC >= thresholds.batteryTemp.warn) {
    alerts.push({
      id: 'battery-thermal',
      severity: metrics.batteryTemperatureC >= CRITICAL.batteryTemp ? 'critical' : 'warning',
      title: 'Battery temperature high',
      detail: `${metrics.batteryTemperatureC.toFixed(1)}°C — charging may throttle`,
    })
  }

  if (metrics.storagePercent != null && metrics.storagePercent >= thresholds.storage.warn) {
    alerts.push({
      id: 'storage',
      severity: metrics.storagePercent >= CRITICAL.storage ? 'critical' : 'warning',
      title: 'Storage almost full',
      detail: `${Math.round(metrics.storagePercent)}% used — apps may slow down`,
    })
  }

  return alerts
}

export function metricsFromSnapshot(snapshot, fps = null) {
  if (!snapshot) return null
  return {
    capturedAt: snapshot.capturedAt ?? null,
    cpuPercent: snapshot.cpu?.overall ?? null,
    cpuPerCore: Array.isArray(snapshot.cpu?.perCore) ? snapshot.cpu.perCore : [],
    ramPercent: snapshot.memory?.percent ?? null,
    ramUsedBytes: snapshot.memory?.usedBytes ?? null,
    ramTotalBytes: snapshot.memory?.totalBytes ?? null,
    ramAvailableBytes: snapshot.memory?.availBytes ?? null,
    storagePercent: snapshot.storage?.percent ?? null,
    storageUsedBytes: snapshot.storage?.usedBytes ?? null,
    storageTotalBytes: snapshot.storage?.totalBytes ?? null,
    storageFreeBytes: snapshot.storage?.freeBytes ?? null,
    batteryPercent: snapshot.battery?.percent ?? null,
    batteryStatus: snapshot.battery?.status ?? null,
    batteryTemperatureC: snapshot.battery?.temperatureC ?? null,
    batteryCurrentUa: snapshot.battery?.currentUa ?? null,
    temperatureC: snapshot.thermal?.celsius ?? snapshot.battery?.temperatureC ?? null,
    temperatureSource: snapshot.thermal?.celsius != null ? 'Accessible thermal sensor' : snapshot.battery?.temperatureC != null ? 'Battery sensor' : null,
    thermalStatus: snapshot.thermal?.statusLabel ?? null,
    thermalZones: Array.isArray(snapshot.thermal?.zones) ? snapshot.thermal.zones : [],
    fps: fps ?? null,
    refreshRate: snapshot.display?.refreshRate ?? null,
    networkType: snapshot.network?.type ?? null,
    networkValidated: snapshot.network?.validated ?? null,
    networkMetered: snapshot.network?.metered ?? null,
    networkRssi: snapshot.network?.rssi ?? null,
    networkDownKbps: snapshot.network?.downKbps ?? null,
    uptimeMs: snapshot.uptimeMs ?? null,
    device: snapshot.device ?? null,
  }
}

function normalize(value, low, high) {
  if (value == null) return 0
  const span = high - low
  if (span <= 0) return 0
  return clamp((value - low) / span, 0, 1)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
