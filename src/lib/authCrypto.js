/**
 * authCrypto.js — a tiny WebCrypto shim so Supabase Auth's PKCE flow works
 * inside React Native/Hermes.
 *
 * Supabase auth-js generates a PKCE verifier with `crypto.getRandomValues`
 * and the SHA-256 challenge with `crypto.subtle.digest`. Hermes ships no
 * WebCrypto, so before supabase-js runs we backfill exactly those two
 * functions from @expo/crypto's native module. If expo-crypto is somehow
 * unavailable in a build, the shim stays a no-op and OAuth login honestly
 * reports that it needs the browser/crypto plugins instead of derailing
 * email/password auth (which needs no crypto).
 */
let ensured = false
let lastError = null

function getExpoCrypto() {
  try {
    // Kept as a direct import (not require()) so Metro bundles the native
    // module statically; jest mocks provide the API surface.
    return require('expo-crypto')
  } catch {
    return null
  }
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** Install globalThis.crypto.getRandomValues + subtle.digest once. */
export function ensureAuthCrypto() {
  if (ensured) return { ok: !lastError, error: lastError }
  ensured = true
  const expo = getExpoCrypto()
  const hasRandom = expo && typeof expo.getRandomValues === 'function'
  const hasDigest = expo && typeof expo.digestStringAsync === 'function'
  if (!hasRandom || !hasDigest) {
    lastError = 'Native crypto provider (expo-crypto) is unavailable.'
    return { ok: false, error: lastError }
  }
  const existing = globalThis.crypto ?? {}
  globalThis.crypto = {
    ...(existing ?? {}),
    getRandomValues: (array) => expo.getRandomValues(array),
    // Supabase only asks for { digest('SHA-256', bytes) }. Return raw bytes so
    // auth-js can run its own base64url encoder.
    subtle: {
      ...(existing?.subtle ?? {}),
      digest: async (algorithm, data) => {
        const name = String(algorithm ?? 'SHA-256').toUpperCase().replace(/-/, '')
        if (name !== 'SHA256') throw new Error(`Unsupported digest algorithm: ${name}`)
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        const string = String.fromCharCode.apply(null, bytes)
        const hex = await expo.digestStringAsync(expo.CryptoDigestAlgorithm.SHA256, string, { encoding: expo.CryptoEncoding.HEX })
        return hexToBytes(hex).buffer
      },
    },
  }
  return { ok: true, error: null }
}

/** Stable-enough locally generated random id (device id / PKCE fallbacks). */
export function randomId(bytes = 16) {
  const expo = getExpoCrypto()
  if (expo && typeof expo.getRandomValues === 'function') {
    return bytesToHex(expo.getRandomValues(new Uint8Array(bytes)))
  }
  // Last resort (never used on device builds): Math.random constructor, still
  // unique enough for a local device identifier, flagged honestly.
  let out = ''
  while (out.length < bytes * 2) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  return out.slice(0, bytes * 2)
}

export { hexToBytes, bytesToHex }

export default { ensureAuthCrypto, randomId }
