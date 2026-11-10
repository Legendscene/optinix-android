/**
 * supabase.js — the single Supabase client factory for the Optinix Android
 * app. Provides authentication + cloud settings sync; the absence of
 * configuration (no env vars in this build) is an HONEST first-class state:
 * getSupabase() returns null and the account UI explains that instead of
 * pretending.
 *
 * Credentials contract (enforced by .gitignore): only the project URL and
 * the PUBLISHABLE (anon) key ever reach the client bundle. The service_role
 * key, database password and provider secrets stay server-side (Supabase
 * dashboard / Edge Functions) and are never read by app code.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

import { ensureAuthCrypto } from '../lib/authCrypto'

export const SUPABASE_STORE = 'optinix:supabase'

export function supabaseEnv() {
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
  const key = String(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '')
  return {
    url,
    key,
    configured: /^https:\/\/[^\s/]+/.test(url) && key.length > 20,
  }
}

let clientInstance = null

export function getSupabase() {
  if (clientInstance) return clientInstance
  const { url, key, configured } = supabaseEnv()
  if (!configured) return null
  try {
    // PKCE needs a WebCrypto shim on Hermes; without it the client still
    // works for email/password and falls back to the implicit OAuth flow
    // (tokens are handed back through the app deep link either way).
    const cryptoOutcome = ensureAuthCrypto()
    clientInstance = createClient(url, key, {
      auth: {
        // Sessions live in AsyncStorage (app-private storage on device);
        // deep links are handled explicitly in App.js, so no auto URL scan.
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: cryptoOutcome.ok ? 'pkce' : 'implicit',
      },
      global: { headers: { 'X-Optinix-Client': 'android/1.0.0' } },
    })
    return clientInstance
  } catch {
    clientInstance = null
    return null
  }
}

/** Test hook: forget the cached client (new env in tests). */
export function resetSupabaseClient() {
  clientInstance = null
  providerStatusCache = null
}

/**
 * parseProviderSettings — pure mapping of the public /auth/v1/settings body
 * to the only three providers Optinix offers. Unknown bodies degrade to
 * `unknown` so the UI can render an honest "couldn't check" state instead
 * of a fake Ready/Disabled verdict. (Unit-tested in __tests__.) */
export function parseProviderSettings(body) {
  const external = body?.external ?? {}

  function decide(value) {
    if (value === true) return 'enabled'
    if (value === false) return 'disabled'
    return 'unknown'
  }
  return {
    email: decide(external.email),
    google: decide(external.google),
    discord: decide(external.discord),
  }
}

let providerStatusCache = null

/**
 * getProviderStatus — asks the project which auth providers are switched
 * on BEFORE the app opens a browser window. Without this check, tapping
 * Google/Discord on a project whose provider is not enabled yet used to
 * dump the user on a bare Supabase error page. Failure to reach the
 * endpoint returns null — the sign-in flow then proceeds as before
 * instead of blocking on a transient network problem. */
export async function getProviderStatus() {
  const { url, key, configured } = supabaseEnv()
  if (!configured) return null
  if (providerStatusCache) return providerStatusCache
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { method: 'GET', headers: { apikey: key } })
    if (!response.ok) return null
    providerStatusCache = parseProviderSettings(await response.json())
    return providerStatusCache
  } catch {
    return null
  }
}
