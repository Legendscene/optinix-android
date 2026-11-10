/**
 * authUrls.js — pure helpers for OAuth/deep-link callbacks (tested by jest).
 *
 * Supabase redirects back into the app in two shapes:
 *   PKCE:     optinix://auth/callback?code=<code>&type=recovery|signup|...
 *   implicit: optinix://auth/callback#access_token=<at>&refresh_token=<rt>
 * Both may carry `error` / `error_description` when the provider failed.
 * The parser never throws — any malformed link degrades to kind 'other'.
 */

/** True when the URL is an Optinix deep link that carries an auth payload. */
export function isAuthCallbackUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('optinix://')) return false
  return /[?#/]auth\/(?:callback|confirm|token)(?:[?#/]|$)/.test(url)
}

export function parseAuthCallbackUrl(url) {
  const raw = String(url ?? '')
  if (!raw.startsWith('optinix://')) return { kind: 'other', url: raw }
  const base = { url: raw }
  try {
    if (!isAuthCallbackUrl(raw)) return { ...base, kind: 'app-link' }
    const params = new URLSearchParams()
    const hashIndex = raw.indexOf('#')
    const queryIndex = raw.indexOf('?')
    // Query first (PKCE), fragment second (implicit) — same-name query keys
    // win, which is the shape Supabase's PKCE redirect actually uses.
    if (queryIndex >= 0) {
      const length = hashIndex > queryIndex ? hashIndex - queryIndex : undefined
      for (const [key, value] of new URLSearchParams(raw.slice(queryIndex + 1, length))) params.set(key, value)
    }
    if (hashIndex >= 0) {
      for (const [key, value] of new URLSearchParams(raw.slice(hashIndex + 1))) if (!params.has(key)) params.set(key, value)
    }
    if (params.get('error') || params.get('error_description')) {
      return { ...base, kind: 'error', error: params.get('error') || 'unknown', message: params.get('error_description') || null }
    }
    const code = params.get('code')
    const access = params.get('access_token')
    const refresh = params.get('refresh_token')
    const type = params.get('type') || null
    if (code) return { ...base, kind: 'code', code, type }
    if (access && refresh) return { ...base, kind: 'tokens', accessToken: access, refreshToken: refresh, type }
    return { ...base, kind: 'app-link' }
  } catch {
    return { ...base, kind: 'other' }
  }
}

export default parseAuthCallbackUrl
