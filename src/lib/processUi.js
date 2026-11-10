/**
 * processUi.js — pure helpers for the Process Manager screen.
 *
 * Android honesty contract baked in here: an ordinary (non-root) app cannot
 * terminate other processes on modern Android (Android 14+ restricts
 * killBackgroundProcesses() to the calling app's own processes), so nothing
 * in this module produces a "kill" concept — only review/sort/system-settings
 * routing. Per-app RAM figures are not exposed to apps either; only the
 * device-level memory split from the device snapshot is real.
 */
import { relativeTime } from './format'

export const SORT_OPTIONS = [
  { id: 'recent', label: 'Recently used' },
  { id: 'name', label: 'Name' },
  { id: 'foreground', label: 'Screen time' },
]

export const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All apps' },
  { id: 'user', label: 'User apps' },
  { id: 'games', label: 'Games' },
  { id: 'system', label: 'System' },
]

/** Case-insensitive search over label + package name, with optional category filter. */
export function filterApps(apps, query, category = 'all') {
  const list = Array.isArray(apps) ? apps : []
  const needle = String(query ?? '').trim().toLowerCase()
  return list.filter((app) => {
    if (category === 'user' && app?.isSystem) return false
    if (category === 'system' && !app?.isSystem) return false
    if (category === 'games' && !app?.isGame) return false
    if (!needle) return true
    return (
      String(app?.label ?? '').toLowerCase().includes(needle) ||
      String(app?.packageName ?? '').toLowerCase().includes(needle)
    )
  })
}

/**
 * Sort key 'recent' uses lastTimeUsed (ms epoch, may be missing), 'name'
 * sorts by label, 'foreground' by cumulative foreground time. Missing
 * values sort last — never faked to 0.
 */
export function sortApps(apps, key = 'recent') {
  const list = Array.isArray(apps) ? [...apps] : []
  switch (key) {
    case 'name':
      return list.sort((a, b) =>
        String(a?.label ?? '').localeCompare(String(b?.label ?? ''), undefined, { sensitivity: 'base' })
      )
    case 'foreground':
      return list.sort((a, b) => foregroundOf(b) - foregroundOf(a))
    case 'recent':
    default:
      return list.sort((a, b) => {
        const av = Number(a?.lastTimeUsed) || 0
        const bv = Number(b?.lastTimeUsed) || 0
        if (av !== bv) return bv - av
        return String(a?.label ?? '').localeCompare(String(b?.label ?? ''), undefined, { sensitivity: 'base' })
      })
  }
}

function foregroundOf(app) {
  const value = Number(app?.totalTimeInForegroundMs)
  return Number.isFinite(value) ? value : 0
}

/** Human copy for when a package was last seen in the foreground. */
export function lastUsedLabel(app, now = Date.now()) {
  const ts = Number(app?.lastTimeUsed)
  if (!Number.isFinite(ts) || ts <= 0) return 'Usage time not recorded'
  return `Active ${relativeTime(ts, now)}`
}

/** Cumulative foreground screen time label; null stays null → "--". */
export function screenTimeLabel(app) {
  const ms = Number(app?.totalTimeInForegroundMs)
  if (!Number.isFinite(ms) || ms <= 0) return null
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Device-level RAM summary. Accepts either the normalized monitor metrics
 * ({ ramPercent, ramUsedBytes, ramTotalBytes }) or a raw device snapshot
 * ({ memory: { percent, usedBytes, totalBytes } }). Per-app values are never
 * invented here; the percent simply passes through or stays null.
 */
export function summarizeMemory(source) {
  const memory = source?.memory ?? source
  const percent = Number(memory?.percent ?? memory?.ramPercent)
  const used = Number(memory?.usedBytes ?? memory?.ramUsedBytes)
  const total = Number(memory?.totalBytes ?? memory?.ramTotalBytes)
  return {
    usedPercent: Number.isFinite(percent) ? percent : null,
    usedBytes: Number.isFinite(used) ? used : null,
    totalBytes: Number.isFinite(total) ? total : null,
  }
}
