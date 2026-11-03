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
  accent: 'teal', // 'teal' | 'indigo' | 'amber' | 'rose'
  density: 'comfortable', // 'comfortable' | 'compact'
  motion: 'system', // 'system' | 'reduced' | 'full'
  haptics: true,
  notifications: false,
  overlayEnabled: true,
  overlayOpacity: 0.94,
  overlaySize: 56,
  overlayAccent: 'app', // 'app' (follow theme) | 'teal' | 'indigo' | 'amber' | 'rose'
  overlayShortcuts: ['profile', 'timer', 'network'],
  overlayAutoHide: true,
  autoDetectGames: false,
  autoOptimizeOnLaunch: false,
  monitorIntervalMs: 5000,
  batteryConscious: true,
  macroEnabled: false,
  reminderMinutes: 0,
  retentionDays: 30,
  networkTarget: 'https://www.gstatic.com/generate_204',
})

const ALLOWED = {
  mode: ['dark', 'light'],
  accent: ['teal', 'indigo', 'amber', 'rose'],
  overlayAccent: ['app', 'teal', 'indigo', 'amber', 'rose'],
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
