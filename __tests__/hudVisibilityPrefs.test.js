import { DEFAULT_PREFERENCES, sanitizePreferences } from '../src/store/preferences'
import { gamingConfig } from '../src/services/gaming'

const theme = { accent: { color: '#abcdef' } }

describe('In-game HUD visibility modes', () => {
  test('fresh default keeps the slim edge handle and never auto-expands', () => {
    expect(DEFAULT_PREFERENCES.overlayVisibility).toBe('edge')
    expect(DEFAULT_PREFERENCES.overlayEnabled).toBe(true)
    // No persisted "auto expand" preference exists anywhere.
    expect('autoExpand' in DEFAULT_PREFERENCES).toBe(false)
  })

  test('visibility enum is enforced on sanitize', () => {
    expect(sanitizePreferences({ overlayVisibility: 'notification' }).overlayVisibility).toBe('notification')
    expect(sanitizePreferences({ overlayVisibility: 'disabled' }).overlayVisibility).toBe('disabled')
    expect(sanitizePreferences({ overlayVisibility: 'always' }).overlayVisibility).toBe('edge')
  })

  test('gamingConfig passes the visibility mode through to the module enum', () => {
    expect(gamingConfig({ ...DEFAULT_PREFERENCES, overlayVisibility: 'notification' }, theme, false).hudVisibility).toBe('notification')
    expect(gamingConfig(DEFAULT_PREFERENCES, theme, false).hudVisibility).toBe('edge')
  })

  test('stale installs without the key sanitize back to the edge handle', () => {
    const stale = { ...DEFAULT_PREFERENCES }
    delete stale.overlayVisibility
    expect(sanitizePreferences(stale).overlayVisibility).toBe('edge')
  })
})
