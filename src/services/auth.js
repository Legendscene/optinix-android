/**
 * auth.js — Optinix account actions over Supabase Auth (Android).
 *
 * Providers: Email/Password (register + verify + login + reset), Google and
 * Discord via OAuth. All flows return through the `optinix://auth/callback`
 * deep link:
 *   PKCE code    → optinix://auth/callback?code=...&type=...
 *   OAuth tokens → optinix://auth/callback#access_token=...&refresh_token=...
 *
 * Security rules (spec): the app only ever holds the publishable key;
 * secrets for providers live in the Supabase dashboard; the client calls the
 * `delete-account` Edge Function (service-key protected server-side) for
 * account deletion instead of any direct privileged access; client-supplied
 * user IDs are never trusted — everything derives from the authenticated
 * session. Accounts are never auto-merged on matching emails.
 */
import * as WebBrowser from 'expo-web-browser'

import { parseAuthCallbackUrl } from '../lib/authUrls'
import { getProviderStatus, getSupabase, supabaseEnv } from './supabase'

export const OAUTH_PROVIDERS = ['google', 'discord']
export const AUTH_CALLBACK = 'optinix://auth/callback'

const PROVIDER_NAMES = { google: 'Google', discord: 'Discord' }

/** Friendly message map — errors stay honest, never invented success. */
function errorMessage(error, fallback) {
  const raw = String(error?.message ?? error ?? '')
  if (/invalid login credentials/i.test(raw)) return 'Email or password is incorrect.'
  if (/User already registered/i.test(raw)) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (/email not confirmed/i.test(raw)) {
    return 'This email is not verified yet. Check your inbox for the Optinix verification link, then sign in.'
  }
  if (/Password should be/i.test(raw)) return 'Password must be at least 6 characters.'
  if (/rate limit/i.test(raw)) return 'Too many attempts. Wait a minute and try again.'
  if (/Failed to fetch|NetworkError|network|connect/i.test(raw)) return 'Could not reach Optinix Cloud. Check your internet connection.'
  if (/auras|provider.*not enabled.*?google/i.test(raw)) return 'Google sign-in is not enabled on the Optinix Cloud project yet.'
  if (/provider.*not enabled.*?discord/i.test(raw)) return 'Discord sign-in is not enabled on the Optinix Cloud project yet.'
  return raw || fallback
}

/**
 * Pre-flight check: if the cloud project has not enabled this provider yet,
 * opening the authorization URL would only dump the user on a bare Supabase
 * error page. Fail fast with an honest, actionable message instead. A null
 * status (endpoint unreachable) never blocks the normal flow.
 */
async function providerGate(provider) {
  const status = await getProviderStatus()
  if (status && status[provider] === 'disabled') {
    return `The Optinix Cloud project has not switched on ${PROVIDER_NAMES[provider] ?? provider} sign-in yet. It is a one-time setup on the cloud dashboard (see docs/account-setup.md in the project) — the app and this device are fine.`
  }
  return null
}

/**
 * Open the system browser for an OAuth provider and wait for the app
 * deep-link result. PKCE: supabase-js already stakes the verifier in its
 * storage before we open the browser (skipBrowserRedirect keeps it
 * client-driven; the callback code is exchanged by handleAuthCallbackUrl).
 */
export async function signInWithProvider(provider) {
  const client = getSupabase()
  if (!client || !OAUTH_PROVIDERS.includes(provider)) {
    return { ok: false, error: !getSupabase() ? 'Cloud sign-in is not configured in this build.' : `Unsupported provider: ${provider}` }
  }
  const gate = await providerGate(provider)
  if (gate) return { ok: false, error: gate }
  let url = null
  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true },
    })
    if (error) throw error
    url = data?.url
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not start the sign-in flow.') }
  }
  if (!url) return { ok: false, error: 'The Optinix Cloud did not return an authorization link.' }
  let browser
  try {
    browser = await WebBrowser.openAuthSessionAsync(url, AUTH_CALLBACK)
  } catch {
    return { ok: false, error: 'The sign-in browser could not be opened on this device.' }
  }
  if (browser?.type !== 'success' || !browser.url) {
    return { ok: true, cancelled: true, error: null } // browser closed before finishing
  }
  const handled = await handleAuthCallbackUrl(browser.url)
  return { ok: Boolean(handled && handled.kind === 'session'), handled }
}

export async function signUpWithEmail(email, password) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Cloud sign-in is not configured in this build.' }
  try {
    const { data, error } = await client.auth.signUp({
      email: String(email ?? '').trim(),
      password,
      options: { emailRedirectTo: AUTH_CALLBACK },
    })
    if (error) throw error
    // Honesty: the session is null until the user clicks the verify link
    // (unless the project disables confirmations — then a session comes back).
    return {
      ok: true,
      needsVerification: !data?.session,
      user: data?.user ?? null,
    }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Registration failed.') }
  }
}

export async function signInWithEmail(email, password) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Cloud sign-in is not configured in this build.' }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: String(email ?? '').trim(),
      password,
    })
    if (error) throw error
    return { ok: true, user: data?.user ?? null }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Sign-in failed.') }
  }
}

/** Sends the password-reset email; the link lands in the app via deep link. */
export async function requestPasswordReset(email) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Cloud sign-in is not configured in this build.' }
  try {
    const { error } = await client.auth.resetPasswordForEmail(String(email ?? '').trim(), {
      redirectTo: AUTH_CALLBACK,
    })
    if (error) throw error
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not send the reset email.') }
  }
}

/** Password change / first-time set after a recovery deep link. */
export async function updatePassword(newPassword) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Not signed in.' }
  try {
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw error
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not update the password.') }
  }
}

/** Display-name edit → user metadata (profiles row mirrors it via trigger). */
export async function updateDisplayName(name) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Not signed in.' }
  try {
    const { data, error } = await client.auth.updateUser({
      data: { display_name: String(name ?? '').trim().slice(0, 40) },
    })
    if (error) throw error
    return { ok: true, user: data?.user ?? null }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not save the name.') }
  }
}

export async function signOut() {
  const client = getSupabase()
  if (!client) return { ok: true }
  try {
    const { error } = await client.auth.signOut()
    if (error) throw error
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Sign-out failed. The session stays on this device.') }
  }
}

/**
 * Account deletion: calls the protected `delete-account` Edge Function.
 * The function re-verifies the caller's JWT server-side and removes the
 * user (Cascade wipes owned rows via FK ON DELETE CASCADE + RLS).
 */
export async function requestAccountDeletion() {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Not signed in.' }
  try {
    const { data, error } = await client.functions.invoke('delete-account')
    if (error) throw error
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error))
    }
    // Server removed the auth record; clear the local session regardless.
    await client.auth.signOut()
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, 'Account deletion failed. Nothing was deleted; try again later.'),
    }
  }
}

/** Link another identity (Google/Discord) to the current user. */
export async function linkProvider(provider) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Not signed in.' }
  const gate = await providerGate(provider)
  if (gate) return { ok: false, error: gate }
  try {
    const { data, error } = await client.auth.linkIdentity({
      provider,
      options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true },
    })
    if (error) throw error
    const url = data?.url
    if (!url) return { ok: false, error: 'The Optinix Cloud did not return a linking link.' }
    let browser
    try {
      browser = await WebBrowser.openAuthSessionAsync(url, AUTH_CALLBACK)
    } catch {
      return { ok: false, error: 'The sign-in browser could not be opened on this device.' }
    }
    if (browser?.type !== 'success' || !browser.url) return { ok: true, cancelled: true }
    const handled = await handleAuthCallbackUrl(browser.url)
    return { ok: Boolean(handled && handled.kind === 'session'), handled }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Linking failed.') }
  }
}

/** Unlink one non-password identity. */
export async function unlinkProvider(identityId) {
  const client = getSupabase()
  if (!client) return { ok: false, error: 'Not signed in.' }
  try {
    const { error } = await client.auth.unlinkIdentity({ identityId })
    if (error) throw error
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not unlink this provider.') }
  }
}

/**
 * One-time-per-URL deep-link resolver. Returns a description of what
 * happened so the UI/Above layer can react ({ kind, session?, error? }); a
 * null return means "not an auth deep link".
 */
const seenUrls = new Set()

export async function handleAuthCallbackUrl(rawUrl) {
  const parsed = parseAuthCallbackUrl(rawUrl)
  if (!['code', 'tokens', 'error'].includes(parsed.kind)) return null
  if (seenUrls.has(parsed.url)) return { kind: 'duplicate' }
  seenUrls.add(parsed.url)
  if (seenUrls.size > 50) {
    const first = seenUrls.values().next().value
    seenUrls.delete(first)
  }
  if (parsed.kind === 'error') {
    return { kind: 'error', error: parsed.error, message: parsed.message }
  }
  const client = getSupabase()
  if (!client) return { kind: 'error', error: 'Cloud sign-in is not configured in this build.' }
  try {
    if (parsed.kind === 'code') {
      const { error } = await client.auth.exchangeCodeForSession(parsed.code)
      if (error) throw error
      return { kind: 'session', type: parsed.type }
    }
    // Implicit tokens (fallback when no native crypto in the build).
    const { error } = await client.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    })
    if (error) throw error
    return { kind: 'session', type: parsed.type }
  } catch (error) {
    return { kind: 'error', error: parsed.error ?? 'exchange_failed', message: errorMessage(error, 'The sign-in link was not accepted. Request a fresh one.') }
  }
}

/** Snapshot for screens: { configured, session/user or null } — null when env missing. */
export async function getAuthStatus() {
  const client = getSupabase()
  if (!client) return { configured: false, user: null, env: supabaseEnv() }
  try {
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    return { configured: true, user: data?.session?.user ?? null, env: supabaseEnv() }
  } catch {
    return { configured: true, user: null, env: supabaseEnv(), sessionError: true }
  }
}

export default {
  OAUTH_PROVIDERS,
  AUTH_CALLBACK,
  signInWithProvider,
  signUpWithEmail,
  signInWithEmail,
  requestPasswordReset,
  updatePassword,
  updateDisplayName,
  signOut,
  requestAccountDeletion,
  linkProvider,
  unlinkProvider,
  handleAuthCallbackUrl,
  getAuthStatus,
}
