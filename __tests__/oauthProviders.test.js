/**
 * oauthProviders.test.js — the pure parser behind the pre-flight provider
 * check. The check exists so tapping Google/Discord can never dump a user
 * on the cloud's own "provider not enabled" error page: the app asks the
 * public /auth/v1/settings endpoint first and degrades honestly.
 */
import { parseProviderSettings } from '../src/services/supabase'

describe('parseProviderSettings', () => {
  it('reads the real /auth/v1/settings shape (2026-11-09 state)', () => {
    expect(parseProviderSettings({
      external: { email: true, google: false, discord: false },
      disable_signup: false,
      mailer_autoconfirm: false,
    })).toEqual({ email: 'enabled', google: 'disabled', discord: 'disabled' })
  })

  it('marks enabled providers', () => {
    expect(parseProviderSettings({ external: { email: true, google: true, discord: true } }))
      .toEqual({ email: 'enabled', google: 'enabled', discord: 'enabled' })
  })

  it('degrades missing/unknown fields to unknown instead of guessing', () => {
    expect(parseProviderSettings({ external: { email: true } }))
      .toEqual({ email: 'enabled', google: 'unknown', discord: 'unknown' })
    expect(parseProviderSettings({ external: { google: 'yes-please' } }))
      .toEqual({ email: 'unknown', google: 'unknown', discord: 'unknown' })
  })

  it('never throws on junk bodies', () => {
    expect(parseProviderSettings(null)).toEqual({ email: 'unknown', google: 'unknown', discord: 'unknown' })
    expect(parseProviderSettings()).toEqual({ email: 'unknown', google: 'unknown', discord: 'unknown' })
    expect(parseProviderSettings('nope')).toEqual({ email: 'unknown', google: 'unknown', discord: 'unknown' })
  })
})
