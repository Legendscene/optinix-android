/**
 * preferences.js — persisted app preferences, mirroring the desktop app's
 * PreferencesContext contract (mode, accent, density, motion) plus the few
 * Android-only toggles the optimizer needs.
 *
 * Storage is AsyncStorage; reads are best-effort and a corrupt/unreadable
 * payload falls back to defaults instead of throwing, so a broken write can
 * never brick the app on launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'

export const STORAGE_KEY = 'optinix:prefs:v1'

export const DEFAULT_PREFERENCES = Object.freeze({
  onboardingDone: false,
  mode: 'dark', // 'dark' | 'light'
  accent: 'mono', // 'mono' (desktop default) | 'teal' | 'indigo' | 'amber' | 'rose'
  density: 'comfortable', // 'comfortable' | 'compact'
  motion: 'system', // 'system' | 'reduced' | 'full'
  haptics: true,
  notifications: false,
  overlayEnabled: true,
  overlayOpacity: 0.94,
  overlaySize: 56,
  overlayAccent: 'app', // 'app' (follow theme) | 'mono' | 'teal' | 'indigo' | 'amber' | 'rose'
  overlayShortcuts: ['profile', 'timer', 'network'],
  overlayAutoHide: true,
  // Timed panel collapse is OFF by default (2026-11-10): the Realme-assistant
  // model is tap-outside/minimize dismissal, never a timer. Saved '5'/'10'/'20'
  // values from test installs are reset once via autoCollapseResetV2 below;
  // Settings still offers the timer for anyone who wants it.
  overlayAutoCollapse: 'never',
  // One-time marker: old installs carry a saved collapse timer (the phone's
  // was '5', set during testing); sanitize folds it to 'never' exactly once.
  autoCollapseResetV2: false,
  // Control-HUD visibility over games: 'edge' = slim edge handle, 'notification'
  // = no handle, reopen via the notification's "Show game HUD" action,
  // 'disabled' = stop the gaming service, timer and both HUD windows.
  overlayVisibility: 'edge',
  autoDetectGames: false,
  monitorIntervalMs: 5000,
  batteryConscious: true,
  macroEnabled: false,
  reminderMinutes: 0,
  retentionDays: 30,
  networkTarget: 'https://www.gstatic.com/generate_204',
  // Separate FPS stats HUD (second overlay window). Game FPS itself is not
  // measurable on Android; the HUD always renders it as honest "--".
  fpsHudEnabled: false,
  // One-time marker (2026-11-10): installs upgraded from the early test builds
  // carried a saved `fpsHudEnabled: true`; sanitize turns the plate off once,
  // then this marker preserves any later, deliberate user choice.
  fpsHudResetV2: false,
  fpsHudMode: 'minimal', // 'minimal' | 'compact' | 'detailed'
  fpsHudOpacity: 0.9,
  fpsHudCorner: 'topLeft', // 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  fpsHudScale: 1,
  fpsHudMetrics: ['cpu', 'ram', 'temp', 'battery', 'refresh'], // visible in detailed mode
})

const ALLOWED = {
  mode: ['dark', 'light'],
  accent: ['mono', 'teal', 'indigo', 'amber', 'rose'],
  overlayAccent: ['app', 'mono', 'teal', 'indigo', 'amber', 'rose'],
  overlayAutoCollapse: ['never', '5', '10', '20'],
  overlayVisibility: ['edge', 'notification', 'disabled'],
  fpsHudMode: ['minimal', 'compact', 'detailed'],
  fpsHudCorner: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
  density: ['comfortable', 'compact'],
  motion: ['system', 'reduced', 'full'],
}

/** Keep only known keys + valid enum values; clamp numeric fields. */
export function sanitizePreferences(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES }
  const next = { ...DEFAULT_PREFERENCES }
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in DEFAULT_PREFERENCES)) continue
    if (ALLOWED[key] && !ALLOWED[key].includes(value)) continue
    if (typeof DEFAULT_PREFERENCES[key] === 'boolean' && typeof value !== 'boolean') continue
    if (typeof DEFAULT_PREFERENCES[key] === 'number' && !Number.isFinite(value)) continue
    next[key] = value
  }
  next.overlayOpacity = Math.max(0.4, Math.min(1, Number(next.overlayOpacity) || 0.94))
  next.monitorIntervalMs = Math.max(2000, Math.min(30000, Number(next.monitorIntervalMs) || 5000))
  next.overlaySize = [48, 56, 64, 72].includes(next.overlaySize) ? next.overlaySize : 56
  next.reminderMinutes = [0, 15, 30, 45, 60].includes(next.reminderMinutes) ? next.reminderMinutes : 0
  next.retentionDays = [7, 30, 90].includes(next.retentionDays) ? next.retentionDays : 30
  next.overlayShortcuts = Array.isArray(next.overlayShortcuts)
    ? [...new Set(next.overlayShortcuts.filter((key) => ['profile', 'dnd', 'screenshot', 'record', 'timer', 'network', 'macro'].includes(key)))].slice(0, 4)
    : [...DEFAULT_PREFERENCES.overlayShortcuts]
  next.fpsHudOpacity = Math.max(0.4, Math.min(1, Number(next.fpsHudOpacity) || 0.9))
  next.fpsHudScale = Math.max(0.7, Math.min(1.6, Number(next.fpsHudScale) || 1))
  // One-time stats-HUD reset (see fpsHudResetV2 in DEFAULT_PREFERENCES).
  if (next.fpsHudEnabled && next.fpsHudResetV2 !== true) {
    next.fpsHudEnabled = false
  }
  next.fpsHudResetV2 = true
  // One-time auto-collapse fold to 'never' (see autoCollapseResetV2 in
  // DEFAULT_PREFERENCES): a timer-collapsing panel reads as "self-closing
  // junk" during play; dismissal is tap-outside/minimize.
  if (next.overlayAutoCollapse !== 'never' && next.autoCollapseResetV2 !== true) {
    next.overlayAutoCollapse = 'never'
  }
  next.autoCollapseResetV2 = true
  next.fpsHudMetrics = Array.isArray(next.fpsHudMetrics)
    ? [...new Set(next.fpsHudMetrics.filter((key) => ['cpu', 'ram', 'temp', 'battery', 'refresh'].includes(key)))]
    : [...DEFAULT_PREFERENCES.fpsHudMetrics]
  if (typeof next.networkTarget !== 'string' || !/^https:\/\/[^\s/@#]+(?:\/[^\s#]*)?$/.test(next.networkTarget) || next.networkTarget.length > 300) next.networkTarget = DEFAULT_PREFERENCES.networkTarget
  return next
}

export async function loadPreferences() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return sanitizePreferences(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export async function savePreferences(prefs) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}

export function resetPreferences() {
  return { ...DEFAULT_PREFERENCES }
}
