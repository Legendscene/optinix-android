const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function clamp(value, min, max) {
  if (value == null || Number.isNaN(value)) return null
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes, digits = 1) {
  if (bytes == null || Number.isNaN(bytes)) return '--'
  if (bytes < 0) return '--'
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${BYTE_UNITS[unit]}`
}

export function formatPercent(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '--'
  return `${value.toFixed(digits)}%`
}

export function formatTemperature(celsius, digits = 1) {
  if (celsius == null || Number.isNaN(celsius)) return '--'
  return `${celsius.toFixed(digits)}°C`
}

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '--'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function formatCount(value) {
  if (value == null || Number.isNaN(value)) return '--'
  return Math.round(value).toLocaleString('en-US')
}

export function formatRate(kbps) {
  if (kbps == null || Number.isNaN(kbps)) return '--'
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`
  return `${Math.round(kbps)} Kbps`
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return 'never'
  const delta = Math.max(0, now - timestamp)
  if (delta < 5000) return 'just now'
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}
