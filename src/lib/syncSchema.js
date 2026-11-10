/**
 * syncSchema.js — pure payload/merge helpers for cloud settings sync
 * (tested by jest). The service layer (cloudSync.js) calls these around the
 * real Supabase network calls.
 *
 * Honesty rules carried over: the payload contains only PRE user-chosen
 * settings — never credentials/tokens (none exist on this app anyway), never
 * device-specific runtime state, and never simulated statuses. Sections map
 * to the user-facing feature groups:
 *   theme   → appearance (mode/accent/density/motion/haptics)
 *   overlay → in-game HUD (opacity/size/accent/shortcuts/idle/collapse)
 *   gaming  → FPS HUD, sessions, sampling, retention, diagnostics target
 *   library → saved game entries + per-game profiles
 *   macros  → utility macros (user-started only, synced as data)
 * Discord RPC preference has no Android equivalent today — it is modelled
 * in the schema (phase 2 on the desktop) and simply never produced here.
 */
import { DEFAULT_PREFERENCES, sanitizePreferences } from '../store/preferences'

export const SYNC_SCHEMA_VERSION = 1

export const SECTION_PREFERENCES = {
  theme: ['mode', 'accent', 'density', 'motion', 'haptics'],
  overlay: ['overlayEnabled', 'overlayOpacity', 'overlaySize', 'overlayAccent', 'overlayShortcuts', 'overlayAutoHide', 'overlayAutoCollapse', 'overlayVisibility'],
  gaming: ['fpsHudEnabled', 'fpsHudMode', 'fpsHudOpacity', 'fpsHudCorner', 'fpsHudScale', 'fpsHudMetrics', 'autoDetectGames', 'notifications', 'batteryConscious', 'monitorIntervalMs', 'reminderMinutes', 'retentionDays', 'networkTarget', 'macroEnabled'],
}

const PREFERENCE_KEYS = Object.values(SECTION_PREFERENCES).flat()
export const SYNCED_PREFERENCE_KEYS = PREFERENCE_KEYS

/** Device-local-only keys — never uploaded, never overwritten by the cloud. */
export const LOCAL_ONLY_PREFERENCE_KEYS = ['onboardingDone']

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Build the upload payload from the three local stores' current data. */
export function buildSyncPayload({ preferences, library, macros } = {}) {
  const payload = { version: SYNC_SCHEMA_VERSION, sections: {} }
  if (isPlainObject(preferences)) {
    for (const [section, keys] of Object.entries(SECTION_PREFERENCES)) {
      payload.sections[section] = {}
      for (const key of keys) {
        if (key in preferences) payload.sections[section][key] = preferences[key]
      }
    }
  }
  // Game library: artwork bytes/icons and discovery noise stay local; only
  // user-chosen fields go to the cloud (the store's sanitize enforces shape
  // again on the way back IN).
  if (isPlainObject(library) && Array.isArray(library.games)) {
    payload.sections.library = {
      games: library.games.map((game) => ({
        packageName: String(game.packageName ?? ''),
        label: String(game.label ?? ''),
        installed: game.installed !== false,
        favorite: game.favorite === true,
        manual: game.manual === true,
        detection: game.detection === 'category' ? 'category' : game.manual ? 'manual' : 'heuristic',
        lastLaunchedAt: typeof game.lastLaunchedAt === 'number' ? game.lastLaunchedAt : null,
        profile: isPlainObject(game.profile) ? game.profile : null,
      })).filter((game) => game.packageName),
      excluded: Array.isArray(library.excluded) ? library.excluded.map(String) : [],
      discoveryEnabled: library.discoveryEnabled === true,
    }
  }
  if (isPlainObject(macros) && Array.isArray(macros.macros)) {
    payload.sections.macros = { macros: macros.macros }
  }
  return payload
}

/** Validate + split a cloud payload back into store-shaped pieces. */
export function splitSyncPayload(payload) {
  const empty = { preferences: null, library: null, macros: null }
  if (!isPlainObject(payload) || !isPlainObject(payload.sections)) return empty
  const prefsFromCloud = {}
  for (const [section, keys] of Object.entries(SECTION_PREFERENCES)) {
    const sectionData = payload.sections[section]
    if (!isPlainObject(sectionData)) continue
    for (const key of keys) if (key in sectionData) prefsFromCloud[key] = sectionData[key]
  }
  const librarySection = payload.sections.library
  const macrosSection = payload.sections.macros
  return {
    preferences: Object.keys(prefsFromCloud).length > 0 ? prefsFromCloud : null,
    library: isPlainObject(librarySection) && Array.isArray(librarySection.games)
      ? {
          games: librarySection.games.filter((game) => game && typeof game.packageName === 'string' && game.packageName),
          excluded: Array.isArray(librarySection.excluded) ? librarySection.excluded : [],
          discoveryEnabled: librarySection.discoveryEnabled === true,
        }
      : null,
    macros: isPlainObject(macrosSection) ? macrosSection : null,
  }
}

/**
 * Merge a cloud preferences payload over local ones with sanitization.
 * Cloud values only REACH here for known keys with valid values (both
 * enforced by sanitizePreferences), so unknown/hostile keys vanish.
 */
export function mergePreferences(cloud, local) {
  return sanitizePreferences({ ...cloud, ...(local ?? {}) })
}

/**
 * Decide the action for a (re)connect: 'restore' (only remote available),
 * 'upload' (local state newer / no remote row), 'restore-cloud-newer' (both
 * exist, cloud is the newer write — cloud-wins policy), 'idle', or
 * 'conflict' (both writes newer than the last handshake — refuses to guess
 * and hands the choice to the UI, which asks instead of silently clobbering).
 */
export function decideSyncAction({ remoteUpdatedAt = null, lastSyncedAt = null, hasLocalEdits = false } = {}) {
  const toTime = (value) => (value ? new Date(value).getTime() : null)
  const remote = toTime(remoteUpdatedAt)
  const last = toTime(lastSyncedAt)
  if (remote == null) return 'upload'
  if (!last) return hasLocalEdits ? 'conflict' : 'restore'
  if (remote > last && hasLocalEdits) return 'conflict'
  if (remote > last) return 'restore-cloud-newer'
  return 'upload'
}

export { DEFAULT_PREFERENCES }
