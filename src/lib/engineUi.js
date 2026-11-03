export const DELTA_LABELS = {
  ramPercent: { label: 'RAM', unit: '%', goodWhenLower: true },
  cpuPercent: { label: 'CPU', unit: '%', goodWhenLower: true },
  storagePercent: { label: 'STORAGE', unit: '%', goodWhenLower: true },
  temperatureC: { label: 'TEMP', unit: '°C', goodWhenLower: true },
  pingMs: { label: 'PING', unit: 'ms', goodWhenLower: true },
  fps: { label: 'APP FRAME RATE', unit: '', goodWhenLower: false },
}

export function signed(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}${rounded}`
}

export function summarizeDelta(delta, limit = 4) {
  if (!delta) return []
  const entries = []
  for (const [key, meta] of Object.entries(DELTA_LABELS)) {
    const value = delta[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    const meaningful = Math.abs(value) >= (meta.unit === '%' ? 0.1 : 0.5)
    if (!meaningful) continue
    entries.push({
      key,
      label: meta.label,
      value,
      text: `${signed(value)}${meta.unit}`,
      tone: deltaTone(value, meta.goodWhenLower),
    })
  }
  return entries.slice(0, limit)
}

export function deltaTone(value, goodWhenLower) {
  if (value == null || value === 0) return 'neutral'
  const improved = goodWhenLower ? value < 0 : value > 0
  return improved ? 'success' : 'warn'
}

export function describeExecution(execution) {
  if (!execution) return null
  if (execution.message) return execution.message
  if (execution.supported === false) {
    return execution.message ?? 'This action is not available on this device.'
  }
  if (execution.reason === 'no-candidates') {
    return execution.message ?? 'Nothing to optimise right now.'
  }
  if (typeof execution.freedBytes === 'number') return 'Cache cleared'
  if (typeof execution.killed === 'number' && execution.killed > 0) {
    return `${execution.killed} background app${execution.killed === 1 ? '' : 's'} closed`
  }
  if (execution.actions?.length) return 'Action completed'
  return execution.note ?? 'Completed'
}
