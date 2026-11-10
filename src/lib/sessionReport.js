import { formatDuration, formatPercent, formatTemperature } from './format'

/**
 * Session summaries only ever contain readings the service actually sampled.
 * Missing values stay `--` in the share sheet exactly as they do in the app.
 */
export function sessionReportLines(entry = {}) {
  const safe = entry ?? {}
  return [
    ['Game', safe.gameLabel || 'Gaming session'],
    ['Profile', safe.profileName ?? 'Balanced'],
    ['Measured time', formatDuration(safe.durationMs)],
    ['CPU average', formatPercent(safe.cpuAverage)],
    ['RAM average', formatPercent(safe.ramAverage)],
    ['Peak temperature', formatTemperature(safe.tempPeak)],
    ['Temperature source', safe.temperatureSource || 'unavailable'],
    ['Ended', safe.interrupted ? 'interrupted at the last checkpoint' : safe.reason || 'user stopped'],
  ]
}

export function sessionShareText(entry = {}) {
  const safe = entry ?? {}
  const when = safe.startedAt ? new Date(safe.startedAt).toLocaleString() : null
  const header = `Optinix gaming session${when ? ` · ${when}` : ''}`
  const body = sessionReportLines(safe).map(([label, value]) => `${label}: ${value}`).join('\n')
  return `${header}\n${body}\n\nMeasured on this device during an Optinix session. Game FPS is not measurable on Android.`
}
