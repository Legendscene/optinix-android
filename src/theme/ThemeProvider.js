/**
 * ThemeProvider.js — resolves the design tokens into a concrete theme for the
 * current mode/accent/density, exactly like the desktop app flips
 * `data-theme` / `data-accent` / `data-density` on <html>.
 *
 * Everything a component needs is on one object from `useTheme()`.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AccessibilityInfo } from 'react-native'

import {
  ACCENTS,
  DARK,
  DENSITY,
  GRADIENTS,
  LIGHT,
  radius as radiusTokens,
  shadows as shadowTokens,
  spacing as spacingTokens,
  statusPalette,
  typography as typographyTokens,
} from '../lib/designTokens'
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  sanitizePreferences,
} from '../store/preferences'
import {
  notifyPreferencesChanged,
  registerPreferencesBridge,
} from './syncHub'

const ThemeContext = createContext(null)

/** Reduce the two big token tables into one flat theme object. */
export function buildTheme(prefs) {
  const isDark = prefs.mode !== 'light'
  const base = isDark ? DARK : LIGHT
  const accentSet = (ACCENTS[prefs.accent] || ACCENTS.mono)[isDark ? 'dark' : 'light']
  const density = DENSITY[prefs.density] || DENSITY.comfortable
  const gradients = GRADIENTS[isDark ? 'dark' : 'light']

  const colors = {
    mode: base.mode,
    bg: {
      0: base.surface[0],
      1: base.surface[1],
      2: base.surface[2],
      3: base.surface[3],
      4: base.surface[4],
      overlay: base.overlay,
      scrim: base.scrim,
      grid: base.grid,
    },
    border: base.border,
    text: base.text,
    semantic: base.semantic,
    chart: base.chart,
  }

  return {
    mode: prefs.mode,
    isDark,
    accent: {
      color: accentSet.accent,
      hover: accentSet.hover,
      dim: accentSet.dim,
      ink: accentSet.ink,
      line: accentSet.line,
      onAccent: accentSet.onAccent,
    },
    colors,
    gradients,
    shadow: shadowTokens,
    radius: radiusTokens,
    spacing: spacingTokens,
    density,
    typography: typographyTokens,
    status: statusPalette({ accent: accentSet.accent, ...base }),
  }
}

export function ThemeProvider({ children, initialPreferences }) {
  const [preferences, setPreferences] = useState(
    () => sanitizePreferences(initialPreferences || DEFAULT_PREFERENCES),
  )
  const [hydrated, setHydrated] = useState(Boolean(initialPreferences))
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const writes = useRef(Promise.resolve())
  const mounted = useRef(true)
  const preferencesRef = useRef(preferences)
  const applyResolvers = useRef([])

  useEffect(() => {
    mounted.current = true
    if (!initialPreferences) {
      loadPreferences().then((loaded) => {
        if (mounted.current) {
          setPreferences(loaded)
          setHydrated(true)
        }
      })
    }
    return () => {
      mounted.current = false
    }
  }, [initialPreferences])

  // Cloud sync bridge: read current values, hear committed changes, and let
  // the cloud engine apply a stored-subset WITHOUT triggering a save loop
  // (the applied subset persist exactly like a user edit — the engine then
  // marks its own handshake so it never re-uploads what it just restored).
  useEffect(() => {
    const unregister = registerPreferencesBridge({
      read: () => preferencesRef.current,
      ready: () => hydrated && mounted.current,
      apply: (cloudSubset) => new Promise((resolve) => {
        const current = preferencesRef.current
        const next = sanitizePreferences({ ...current, ...(cloudSubset ?? {}) })
        if (JSON.stringify(next) === JSON.stringify(current)) {
          resolve(Boolean(hydrated)) // subset already matches; nothing to commit
          return
        }
        applyResolvers.current.push(resolve)
        setPreferences(next)
      }),
    })
    return () => {
      unregister()
    }
  }, [hydrated])

  // Keep the ref in sync (read path uses it, never stale state closures).
  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => active && setSystemReducedMotion(Boolean(value)))
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) =>
      setSystemReducedMotion(Boolean(value)),
    )
    return () => {
      active = false
      sub?.remove?.()
    }
  }, [])

  const update = useCallback((patch) => {
    setPreferences((prev) => {
      const next = sanitizePreferences({ ...prev, ...patch })
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setPreferences((previous) => ({ ...DEFAULT_PREFERENCES, onboardingDone: previous.onboardingDone }))
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writes.current = writes.current.then(() => savePreferences(preferences)).then((ok) => {
      if (mounted.current) setSaveError(ok ? null : 'Preferences could not be saved. Check free device storage.')
      // Cloud-applied subsets resolve only after their values persisted.
      if (applyResolvers.current.length) {
        const resolvers = applyResolvers.current
        applyResolvers.current = []
        resolvers.forEach((resolve) => {
          try {
            resolve(ok)
          } catch {
            /* keep flushing */
          }
        })
      }
      // Non-React consumers (the cloud sync engine) hear every committed
      // change here — sanitized values only, after persistence succeeded.
      notifyPreferencesChanged(preferences)
    })
  }, [preferences, hydrated])

  const reducedMotion =
    preferences.motion === 'reduced' ||
    (preferences.motion === 'system' && systemReducedMotion)

  const theme = useMemo(() => buildTheme(preferences), [preferences])

  const value = useMemo(
    () => ({ theme, preferences, update, reset, hydrated, reducedMotion, saveError }),
    [theme, preferences, update, reset, hydrated, reducedMotion, saveError],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>')
  }
  return ctx.theme
}

export function usePreferences() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('usePreferences must be used inside <ThemeProvider>')
  }
  return ctx
}

export default ThemeProvider
