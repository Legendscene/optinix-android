/**
 * syncHub.js — the bridge between user-facing preference state (owned by
 * ThemeProvider as React state) and the cloud sync engine.
 *
 * cloudSync.js is a plain singleton service that runs outside React: it needs
 * to READ the current preferences snapshot (to build the upload payload),
 * HEAR about edits (to schedule the debounced upload) and WRITE cloud values
 * back into the UI without ever fighting the user (an apply that happens the
 * same instant as a user edit simply wins/loses on commit order, and both go
 * through sanitizePreferences, so no hostile value can sneak in).
 *
 * ThemeProvider registers itself once (the "hub"); everything else calls the
 * plain functions below. Nothing here knows about Supabase — and the theme
 * layer never imports the cloud engine (no cycles).
 */

let bridge = null
const preferenceListeners = new Set()

/**
 * ThemeProvider calls this on mount. Returns an unregister function.
 * bridge = { read(): prefsSnapshot, ready(): boolean, apply(cloudSubset): Promise }
 */
export function registerPreferencesBridge(next) {
  bridge = next ?? null
  return () => {
    if (bridge === next) bridge = null
  }
}

export function isPreferencesReady() {
  try {
    return Boolean(bridge?.ready?.())
  } catch {
    return false
  }
}

/** Current preference snapshot, or null before the bridge exists/hydrated. */
export function readPreferences() {
  try {
    if (!bridge || !bridge.ready()) return null
    return bridge.read() ?? null
  } catch {
    return null
  }
}

/**
 * Apply a cloud preferences subset over the live state (sanitized inside the
 * provider). Resolves once the values are committed and persisted; returns
 * false when no provider is registered (nothing to apply).
 */
export async function applyCloudPreferences(cloudSubset) {
  const apply = bridge?.apply
  if (typeof apply !== 'function') return false
  await apply(cloudSubset ?? {})
  return true
}

/**
 * Preference-change fan-out to non-React consumers (the sync engine):
 * ThemeProvider notifies after every committed (sanitized, persisted) change.
 */
export function subscribePreferences(listener) {
  preferenceListeners.add(listener)
  return () => preferenceListeners.delete(listener)
}

export function notifyPreferencesChanged(preferences) {
  preferenceListeners.forEach((listener) => {
    try {
      listener(preferences)
    } catch {
      /* a broken consumer never breaks the theme layer */
    }
  })
}

export default { registerPreferencesBridge, subscribePreferences, notifyPreferencesChanged }
