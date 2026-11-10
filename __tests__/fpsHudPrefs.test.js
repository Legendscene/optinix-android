import { DEFAULT_PREFERENCES, sanitizePreferences } from '../src/store/preferences'

describe('FPS HUD preferences', () => {
  test('fresh defaults are minimal, gentle and disabled', () => {
    expect(DEFAULT_PREFERENCES.fpsHudEnabled).toBe(false)
    expect(DEFAULT_PREFERENCES.fpsHudMode).toBe('minimal')
    expect(DEFAULT_PREFERENCES.fpsHudCorner).toBe('topLeft')
    expect(DEFAULT_PREFERENCES.fpsHudOpacity).toBe(0.9)
  })

  test('mode and corner enums are enforced', () => {
    const next = sanitizePreferences({ fpsHudMode: 'cinematic', fpsHudCorner: 'centre' })
    expect(next.fpsHudMode).toBe('minimal')
    expect(next.fpsHudCorner).toBe('topLeft')
    expect(sanitizePreferences({ fpsHudMode: 'detailed', fpsHudCorner: 'bottomRight' })).toMatchObject({
      fpsHudMode: 'detailed',
      fpsHudCorner: 'bottomRight',
    })
  })

  test('opacity and scale stay in bounds', () => {
    expect(sanitizePreferences({ fpsHudOpacity: 5 }).fpsHudOpacity).toBe(1)
    expect(sanitizePreferences({ fpsHudOpacity: 0.1 }).fpsHudOpacity).toBe(0.4)
    expect(sanitizePreferences({ fpsHudScale: 9 }).fpsHudScale).toBe(1.6)
    expect(sanitizePreferences({ fpsHudScale: 'tiny' }).fpsHudScale).toBe(1)
  })

  test('metric selection is filtered to measurable lines', () => {
    const next = sanitizePreferences({ fpsHudMetrics: ['cpu', 'gpu', 'temp', 'refresh'] })
    expect(next.fpsHudMetrics).toEqual(['cpu', 'temp', 'refresh'])
    expect(sanitizePreferences({ fpsHudMetrics: 'cpu' }).fpsHudMetrics).toEqual(
      DEFAULT_PREFERENCES.fpsHudMetrics
    )
  })

  test('the dead autoOptimizeOnLaunch preference is gone', () => {
    expect('autoOptimizeOnLaunch' in DEFAULT_PREFERENCES).toBe(false)
    // Unknown keys are dropped even if they arrive from old installs.
    const next = sanitizePreferences({ autoOptimizeOnLaunch: true, mode: 'dark' })
    expect(next.autoOptimizeOnLaunch).toBeUndefined()
  })
})
