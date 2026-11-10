import { gamingConfig, hudAccentHex } from '../src/services/gaming'
import { ACCENTS } from '../src/lib/designTokens'

const theme = { accent: { color: '#abcdef' } }
const basePrefs = {
  overlayOpacity: 0.94,
  overlaySize: 56,
  overlayShortcuts: ['timer'],
  overlayAutoHide: true,
  batteryConscious: false,
  monitorIntervalMs: 5000,
}

describe('HUD accent selection', () => {
  test('follows the app theme accent when set to app', () => {
    const prefs = { ...basePrefs, overlayAccent: 'app' }
    expect(hudAccentHex(prefs, theme)).toBe('#abcdef')
    expect(gamingConfig(prefs, theme, false).accent).toBe('#abcdef')
  })

  test("overlayAccent 'app' resolves the app accent's dark variant (HUD is always dark)", () => {
    expect(hudAccentHex({ ...basePrefs, overlayAccent: 'app', accent: 'mono' }, theme)).toBe(ACCENTS.mono.dark.accent)
    expect(hudAccentHex({ ...basePrefs, overlayAccent: 'app', accent: 'teal' }, theme)).toBe(ACCENTS.teal.dark.accent)
    expect(hudAccentHex({ ...basePrefs, overlayAccent: 'app', accent: 'mystery' }, theme)).toBe('#abcdef')
  })

  test('falls back to the app theme when the preference is missing or unknown', () => {
    expect(hudAccentHex(basePrefs, theme)).toBe('#abcdef')
    expect(hudAccentHex({ ...basePrefs, overlayAccent: 'neon-pink' }, theme)).toBe('#abcdef')
  })

  test('a custom HUD accent uses the dark-variant hex (HUD is always dark)', () => {
    for (const id of ['mono', 'teal', 'indigo', 'amber', 'rose']) {
      const prefs = { ...basePrefs, overlayAccent: id }
      expect(hudAccentHex(prefs, theme)).toBe(ACCENTS[id].dark.accent)
      expect(gamingConfig(prefs, theme, false).accent).toBe(ACCENTS[id].dark.accent)
    }
  })

  test('a preferences object without overlayAccent keeps the remaining config intact', () => {
    const config = gamingConfig(basePrefs, theme, false)
    expect(config.opacity).toBe(0.94)
    expect(config.size).toBe(56)
    expect(config.autoHide).toBe(true)
    expect(config.autoCollapseSeconds).toBe(10)
  })

  test('the auto-collapse preference maps to seconds and never disables the timer', () => {
    expect(gamingConfig({ ...basePrefs, overlayAutoCollapse: 'never' }, theme, false).autoCollapseSeconds).toBe(0)
    expect(gamingConfig({ ...basePrefs, overlayAutoCollapse: '5' }, theme, false).autoCollapseSeconds).toBe(5)
    expect(gamingConfig({ ...basePrefs, overlayAutoCollapse: '20' }, theme, false).autoCollapseSeconds).toBe(20)
  })
})
