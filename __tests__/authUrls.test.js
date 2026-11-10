import { parseAuthCallbackUrl, isAuthCallbackUrl } from '../src/lib/authUrls'

describe('auth callback url parsing', () => {
  it('recognizes a PKCE code callback', () => {
    const parsed = parseAuthCallbackUrl('optinix://auth/callback?code=abc123&type=recovery')
    expect(parsed.kind).toBe('code')
    expect(parsed.code).toBe('abc123')
    expect(parsed.type).toBe('recovery')
  })

  it('recognizes implicit tokens from the fragment', () => {
    const parsed = parseAuthCallbackUrl('optinix://auth/callback#access_token=at&refresh_token=rt&expires_in=3600')
    expect(parsed.kind).toBe('tokens')
    expect(parsed.accessToken).toBe('at')
    expect(parsed.refreshToken).toBe('rt')
  })

  it('surfaces provider/errors without throwing', () => {
    const parsed = parseAuthCallbackUrl('optinix://auth/callback?error=access_denied&error_description=User+cancel')
    expect(parsed.kind).toBe('error')
    expect(parsed.error).toBe('access_denied')
    expect(parsed.message).toBe('User cancel')
  })

  it('treats other app deep links as navigation, not auth', () => {
    expect(parseAuthCallbackUrl('optinix://games').kind).toBe('app-link')
    expect(parseAuthCallbackUrl('optinix://settings').kind).toBe('app-link')
    expect(parseAuthCallbackUrl('optinix://games').code).toBeUndefined()
  })

  it('ignores foreign schemes and garbage', () => {
    expect(parseAuthCallbackUrl('https://example.com/auth/callback?code=x').kind).toBe('other')
    expect(parseAuthCallbackUrl(undefined).kind).toBe('other')
    expect(parseAuthCallbackUrl('optinix://auth/nothing').kind).toBe('app-link')
    expect(isAuthCallbackUrl(null)).toBe(false)
  })
})
