/**
 * cloudSync.js — the Optinix cloud sync engine (Android).
 *
 * Design rules honoured from the spec:
 *  - Login stays OPTIONAL: with no Supabase env or no signed-in user the app
 *    runs exactly as before and this module reports "disabled".
 *  - Syncs only user settings: theme, overlay, gaming + the game library and
 *    macros ("supported application settings"). Never device credentials,
 *    never tokens, never optimization commands (the cloud payload is DATA
 *    that the local app interprets — the service never executes anything).
 *  - Debounced upload (settings serialize tiles within milliseconds of the
 *    store change), offline retry with backoff, Manual "Sync Now",
 *    Last-synced timestamp surfaced to the UI, and a conflict policy that
 *    refuses to silently guess when BOTH sides moved since the last
 *    handshake (the UI asks the user; cloud-wins is the default suggestion).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Application from 'expo-application'
import * as Device from 'expo-device'

import { randomId } from '../lib/authCrypto'
import {
  buildSyncPayload,
  decideSyncAction,
  splitSyncPayload,
} from '../lib/syncSchema'
import { getSupabase } from './supabase'

export const DEVICE_ID_KEY = 'optinix:deviceId'

const DEBOUNCE_MS = 1200
const RETRY_MS = [15_000, 60_000, 300_000]

let initial = {
  configured: false,
  userId: null,
  status: 'disabled', // disabled | signed-out | idle | syncing | saved | offline | error | conflict
  lastSyncedAt: null,
  lastAction: null, // 'upload' | 'restore' — surfaced so sign-in can say what happened
  pending: 0,
  error: null,
  conflictAt: null,
}
let state = initial
const listeners = new Set()

export function getCloudSyncState() {
  return state
}

export function subscribeCloudSync(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

// ---------------------------------------------------------------------------
// Session + device plumbing
// ---------------------------------------------------------------------------

let sessionStarted = false
let unsubscribeAuth = null
let unsubscribeLibrary = null
let unsubscribeMacros = null
let unsubscribePreferences = null
let pushTimer = null
let dirty = false
let retryTimer = null
let retryStep = 0
let restoreGuard = false

async function getDeviceId() {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const next = randomId(8)
    await AsyncStorage.setItem(DEVICE_ID_KEY, next)
    return next
  } catch {
    return randomId(8)
  }
}

function deviceRow(deviceId) {
  return {
    device_id: deviceId,
    label: [Device?.osName === 'Android' ? (Device?.manufacturer || Device?.brand) : Device?.manufacturer, Device?.modelName].filter(Boolean).join(' ') || 'Android device',
    platform: 'android',
    model: Device?.modelName ?? null,
    app_version: Constants?.expoConfig?.version ?? Application?.nativeApplicationVersion ?? null,
    os_version: Device?.osVersion ? String(Device.osVersion) : null,
  }
}

// ---------------------------------------------------------------------------
// Sync core
// ---------------------------------------------------------------------------

function libraryData() {
  try {
    // Required for the payload; the store lazily hydrates on first change.
    const store = require('../store/gameLibrary').gameLibrary
    return store.getState().ready ? store.getState().data : null
  } catch {
    return null
  }
}

function macrosData() {
  try {
    const store = require('../store/macros').macroStore
    return store.getState().ready ? store.getState().data : null
  } catch {
    return null
  }
}

function preferencesData() {
  try {
    return require('../theme/syncHub').readPreferences()
  } catch {
    return null
  }
}

async function pushPayload(reason) {
  const client = getSupabase()
  const userId = state.userId
  if (!client || !userId) return false
  // Never push a half-hydrated snapshot (cold start could overwrite the
  // cloud with defaults). The store-change triggers all happen post-hydration.
  try {
    if (!require('../theme/syncHub').isPreferencesReady()) return false
  } catch {
    /* hub unavailable in tests — proceed */
  }
  const payload = buildSyncPayload({ preferences: preferencesData(), library: libraryData(), macros: macrosData() })
  setState({ status: 'syncing', error: null })
  try {
    const deviceId = await getDeviceId()
    const now = new Date().toISOString()
    const { error } = await client.from('user_settings').upsert({ user_id: userId, data: payload, device_id: deviceId, updated_at: now }, { onConflict: 'user_id' })
    if (error) throw error
    // Best-effort bookkeeping: devices + history never block a settings push.
    try {
      await client.from('devices').upsert({ user_id: userId, ...deviceRow(deviceId), last_seen_at: now }, { onConflict: 'user_id,device_id' })
      await client.from('sync_history').insert({ user_id: userId, device_id: deviceId, direction: 'upload', detail: { reason, sections: Object.keys(payload.sections ?? {}) } })
    } catch {
      // Contacts/veille only — settings already saved.
    }
    dirty = false
    retryStep = 0
    setState({ status: 'saved', lastSyncedAt: now, lastAction: 'upload', pending: 0, error: null })
    try { await AsyncStorage.setItem(`optinix:synced:${userId}`, now) } catch { /* best effort */ }
    return true
  } catch (error) {
    scheduleRetry()
    setState({ status: 'offline', pending: 1, error: error?.message ?? 'Sync could not reach the cloud. Your settings stay on this device.' })
    return false
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer)
  const delay = RETRY_MS[Math.min(retryStep, RETRY_MS.length - 1)]
  retryStep += 1
  retryTimer = setTimeout(() => {
    if (state.userId && (dirty || state.status === 'offline')) pushPayload('retry')
  }, delay)
}

function schedulePush(source) {
  if (!state.userId) return
  dirty = true
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    // A restore can flip dirty back between the schedule and this tick —
    // only push when there is something genuinely local to save.
    if (dirty) pushPayload(source)
  }, DEBOUNCE_MS)
}

/** Manual "Sync Now" — synchronous upload attempt + honest result. */
export async function syncNow() {
  if (!getSupabase() || !state.userId) {
    setState({ error: state.configured ? 'Sign in to Optinix Account to sync.' : 'Cloud sync is not configured in this build.' })
    return false
  }
  return await pushPayload('manual')
}

/**
 * Apply a split cloud payload over the local stores. Shared by the initial
 * restore, the cloud-newer reconcile and the user's conflict resolution —
 * one implementation so the two paths can never drift apart again.
 */
async function applyRemotePieces(pieces) {
  const { applyCloudPreferences } = require('../theme/syncHub')
  if (pieces.preferences) await applyCloudPreferences(pieces.preferences)
  const lib = pieces.library?.games ? require('../store/gameLibrary').gameLibrary : null
  if (lib) {
    await lib.change((current) => ({
      ...current,
      games: [...pieces.library.games],
      excluded: [...new Set([...pieces.library.excluded, ...current.excluded])],
      // Older payloads carry no discovery choice — keep the local one then.
      discoveryEnabled: typeof pieces.library.discoveryEnabled === 'boolean' ? pieces.library.discoveryEnabled : current.discoveryEnabled,
    }))
  }
  const macroStore = pieces.macros?.macros ? require('../store/macros').macroStore : null
  if (macroStore) await macroStore.change((current) => ({ ...current, macros: [...pieces.macros.macros] }))
}

/**
 * Pull the cloud row and either restore it over local stores or push local
 * (upload / conflict per decideSyncAction). Conflict state surfaces a
 * question to the UI — nothing is overwritten silently.
 */
async function pullAndReconcile() {
  const client = getSupabase()
  const userId = state.userId
  if (!client || !userId || restoreGuard) return
  restoreGuard = true
  try {
    const deviceId = await getDeviceId()
    try {
      await client.from('devices').upsert({ user_id: userId, ...deviceRow(deviceId), last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,device_id' })
    } catch { /* bookkeeping only */ }
    setState({ status: 'syncing', error: null })
    const { data, error } = await client.from('user_settings').select('data, updated_at').eq('user_id', userId).maybeSingle()
    if (error && error.code !== 'PGRST116') throw error
    const lastSyncedRaw = await AsyncStorage.getItem(`optinix:synced:${userId}`).catch(() => null)
    const action = decideSyncAction({
      remoteUpdatedAt: data?.updated_at ?? null,
      lastSyncedAt: lastSyncedRaw ?? null,
      hasLocalEdits: dirty,
    })
    if (action === 'conflict') {
      setState({ status: 'conflict', conflictAt: data?.updated_at ?? null, lastAction: null, error: 'Cloud stored newer settings after your most recent handshake, and edits were made locally meanwhile. Compare and choose: apply the cloud copy, or push this device instead.' })
      return
    }
    if (action === 'restore' || action === 'restore-cloud-newer') {
      await applyRemotePieces(splitSyncPayload(data?.data))
      dirty = false
      const syncedAt = data?.updated_at ?? new Date().toISOString()
      try { await AsyncStorage.setItem(`optinix:synced:${userId}`, syncedAt) } catch { /* best effort */ }
      try {
        await client.from('sync_history').insert({ user_id: userId, device_id: deviceId, direction: 'restore', detail: { sections: Object.keys(data?.data?.sections ?? {}) } })
      } catch { /* bookkeeping only */ }
      setState({ status: 'saved', lastSyncedAt: syncedAt, lastAction: 'restore', pending: 0, error: null, conflictAt: null })
      return
    }
    // upload: either no remote row, or remote older than our last handshake
    await pushPayload('initial-or-stale')
  } catch (error) {
    scheduleRetry()
    setState({ status: error?.code === '42P01' || /relation|migrat/.test(String(error?.message)) ? 'error' : 'offline', error: tableMissingMessage(error) })
  } finally {
    restoreGuard = false
  }
}

function tableMissingMessage(error) {
  const message = String(error?.message ?? error ?? '')
  if (/42P01|relation .* does not exist|migrations/i.test(message)) {
    return 'The Optinix Account tables are not created yet on this Supabase project. Run the provided SQL migration first. Until then nothing syncs and nothing breaks locally.'
  }
  if (/network|fetch|connect/i.test(message)) return 'Cloud could not be reached. Settings stay on this device and upload automatically later.'
  return message || 'Sync could not complete. Local settings are untouched.'
}

/** User accepted the conflict prompt: apply cloud copy over local. */
export async function resolveConflictWithCloud() {
  const stored = state.conflictAt
  setState({ status: 'idle', conflictAt: null, error: null })
  dirty = false
  const client = getSupabase()
  const userId = state.userId
  if (client && userId && stored) {
    const { data } = await client.from('user_settings').select('data, updated_at').eq('user_id', userId).maybeSingle()
    await applyRemotePieces(splitSyncPayload(data?.data))
    try { await AsyncStorage.setItem(`optinix:synced:${userId}`, stored) } catch { /* best effort */ }
    setState({ status: 'saved', lastSyncedAt: stored, lastAction: 'restore', pending: 0 })
    return true
  }
  return false
}

/** User kept the device copy: uploads it immediately (manual push). */
export async function resolveConflictWithDevice() {
  setState({ status: 'idle', conflictAt: null, error: null })
  return pushPayload('conflict-device-wins')
}

// ---------------------------------------------------------------------------
// Lifecycle wiring (called once from App)
// ---------------------------------------------------------------------------

export async function startCloudSync() {
  if (sessionStarted) return
  sessionStarted = true
  const client = getSupabase()
  if (!client) {
    setState({ configured: false, status: 'disabled', error: null })
    return
  }
  setState({ configured: true, status: 'signed-out' })
  const { data: { session } = {} } = await client.auth.getSession().catch(() => ({ data: { session: null } }))
  if (session?.user) {
    const stored = await AsyncStorage.getItem(`optinix:synced:${session.user.id}`).catch(() => null)
    setState({ userId: session.user.id, lastSyncedAt: stored ?? null, status: 'idle' })
    await pullAndReconcile()
  } else {
    setState({ userId: null, status: 'signed-out' })
  }
  unsubscribeAuth = client.auth.onAuthStateChange((event, session) => {
    handleAuthEvent(event, session)
  })
  try {
    const lib = require('../store/gameLibrary').gameLibrary
    unsubscribeLibrary = lib.subscribe(() => schedulePush('library'))
  } catch { /* store unavailable in tests */ }
  try {
    const macroStore = require('../store/macros').macroStore
    unsubscribeMacros = macroStore.subscribe(() => schedulePush('macros'))
  } catch { /* store unavailable in tests */ }
  try {
    const { subscribePreferences } = require('../theme/syncHub')
    unsubscribePreferences = subscribePreferences(() => schedulePush('preferences'))
  } catch { /* hub unavailable in tests */ }
}

function handleAuthEvent(event, session) {
  if (event === 'SIGNED_OUT' || !session?.user) {
    if (state.userId !== (session?.user?.id ?? null) || event === 'SIGNED_OUT') setState({ userId: null, status: 'signed-out', pending: 0, error: null, conflictAt: null, lastSyncedAt: null })
    return
  }
  if (session.user.id !== state.userId) {
    setState({ userId: session.user.id, status: 'idle', error: null, conflictAt: null })
    pullAndReconcile()
  }
}

export function stopCloudSync() {
  clearTimeout(pushTimer)
  clearTimeout(retryTimer)
  if (unsubscribeAuth) unsubscribeAuth.unsubscribe()
  if (unsubscribeLibrary) unsubscribeLibrary?.()
  if (unsubscribeMacros) unsubscribeMacros?.()
  if (unsubscribePreferences) unsubscribePreferences?.()
  sessionStarted = false
  unsubscribeAuth = null
  unsubscribeLibrary = null
  unsubscribeMacros = null
  unsubscribePreferences = null
}

/** Auth screens call this right after a successful sign-in/reset so the
 *  engine picks up + opens the account depth. */
export async function ensureStarted() {
  if (!sessionStarted) await startCloudSync()
  return getCloudSyncState()
}
