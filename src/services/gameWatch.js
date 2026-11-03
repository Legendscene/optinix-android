import { useSyncExternalStore } from 'react'
import appsNative from '../native/apps'

const DEFAULT_INTERVAL_MS = 5000
const GAME_CACHE_TTL_MS = 10 * 60 * 1000

let timer = null
let running = false
let gameCache = null
let gameCacheAt = 0
let foreground = null
let isGame = false
let gameSince = null
let lastChangeAt = null
let snapshot = { foreground, isGame, gameSince, lastChangeAt, running }

const listeners = new Set()

function emit() {
  snapshot = { foreground, isGame, gameSince, lastChangeAt, running }
  listeners.forEach((listener) => listener(snapshot))
}

export function getGameWatchState() {
  return snapshot
}

export function subscribeGameWatch(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useGameWatch() {
  return useSyncExternalStore(subscribeGameWatch, getGameWatchState, getGameWatchState)
}

export async function refreshGameCache(force = false) {
  const now = Date.now()
  if (!force && gameCache && now - gameCacheAt < GAME_CACHE_TTL_MS) return gameCache
  const games = await appsNative.getGameCandidates()
  gameCache = new Set((games ?? []).map((entry) => entry.packageName))
  gameCacheAt = now
  return gameCache
}

function applyForeground(next) {
  const nowGame = Boolean(next?.isGame) || Boolean(next && gameCache?.has(next.packageName))
  const changed = next?.packageName !== foreground?.packageName || nowGame !== isGame
  if (!changed) return

  foreground = next ?? null
  lastChangeAt = Date.now()
  gameSince = nowGame ? (isGame ? gameSince : Date.now()) : null
  isGame = nowGame
  emit()
}

export async function pollForeground() {
  if (!appsNative.isAvailable) return null
  const next = await appsNative.getForegroundApp()
  if (next) {
    if (!gameCache) await refreshGameCache()
    applyForeground(next)
  }
  return next
}

export function startGameWatch({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (timer != null) return
  running = true
  const interval = Math.max(2000, intervalMs)
  emit()
  pollForeground()
  timer = setInterval(() => {
    pollForeground()
  }, interval)
}

export function stopGameWatch() {
  running = false
  if (timer != null) {
    clearInterval(timer)
    timer = null
  }
  emit()
}

export function resetGameWatch() {
  foreground = null
  isGame = false
  gameSince = null
  lastChangeAt = null
  gameCache = null
  gameCacheAt = 0
  emit()
}
