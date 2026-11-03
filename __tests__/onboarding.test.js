import { DEFAULT_PREFERENCES, sanitizePreferences } from '../src/store/preferences'

describe('onboarding preference', () => {
  it('defaults to showing onboarding once on a fresh install', () => {
    expect(DEFAULT_PREFERENCES.onboardingDone).toBe(false)
    expect(sanitizePreferences({}).onboardingDone).toBe(false)
  })

  it('keeps a recorded true and rejects non-boolean junk', () => {
    expect(sanitizePreferences({ onboardingDone: true }).onboardingDone).toBe(true)
    expect(sanitizePreferences({ onboardingDone: 'yes' }).onboardingDone).toBe(false)
    expect(sanitizePreferences({ onboardingDone: 1 }).onboardingDone).toBe(false)
  })
})
