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

  test('falls back to the app theme when the preference is missing or unknown', () => {
    expect(hudAccentHex(basePrefs, theme)).toBe('#abcdef')
    expect(hudAccentHex({ ...basePrefs, overlayAccent: 'neon-pink' }, theme)).toBe('#abcdef')
  })

  test('a custom HUD accent uses the dark-variant hex (HUD is always dark)', () => {
    for (const id of ['teal', 'indigo', 'amber', 'rose']) {
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
  })
})
