import deviceNative from '../native/device'
import { metricsFromSnapshot } from '../lib/insights'
import { probeLatency } from './networkProbe'

export async function captureMetrics({ fps = false, ping = false } = {}) {
  const snapshot = await deviceNative.getSnapshot()
  if (!snapshot) return null

  const [fpsResult, latency] = await Promise.all([
    fps ? deviceNative.measureFps(800) : Promise.resolve(null),
    ping ? probeLatency({ samples: 2, timeoutMs: 2200 }) : Promise.resolve(null),
  ])

  const metrics = metricsFromSnapshot(snapshot, fpsResult?.fps ?? null)
  if (metrics) {
    metrics.pingMs = latency?.avgMs ?? null
    metrics.pingJitterMs = latency?.jitterMs ?? null
  }
  return metrics
}
