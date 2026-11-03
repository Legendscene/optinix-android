import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import deviceNative from '../native/device'
import { buildAlerts, computeHealth, metricsFromSnapshot } from '../lib/insights'

const MAX_HISTORY = 90
let state = { status: 'idle', metrics: null, health: null, alerts: [], history: [], error: null, lastUpdatedAt: null, intervalMs: 5000 }
let timer = null
let subscription = null
let generation = 0
let running = false
let sampling = false
let appActive = AppState.currentState == null || AppState.currentState === 'active'
let tick = 0
const listeners = new Set()
const setState = (patch) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener(state)) }

export const getMonitorState = () => state
export function subscribeMonitor(listener) { listeners.add(listener); return () => listeners.delete(listener) }
export function useMonitor() { return useSyncExternalStore(subscribeMonitor, getMonitorState, getMonitorState) }

async function withTimeout(promise, ms) {
  let timeout
  try { return await Promise.race([promise, new Promise((resolve) => { timeout = setTimeout(() => resolve(null), ms) })]) }
  finally { clearTimeout(timeout) }
}

export async function sampleNow(forceFps = false) {
  if (sampling || !appActive) return state
  sampling = true
  const token = generation
  try {
    const measureFps = forceFps || tick++ % 3 === 0
    const [snapshot, fpsResult] = await Promise.all([deviceNative.getSnapshot(), measureFps ? withTimeout(deviceNative.measureFps(700), 2000) : null])
    if (token !== generation || !appActive) return state
    if (!snapshot) { setState({ status: 'unavailable', metrics: null, health: null, error: 'Native device metrics are unavailable in this build.' }); return state }
    const fps = measureFps ? fpsResult?.fps ?? null : state.metrics?.fps ?? null
    const metrics = metricsFromSnapshot(snapshot, fps)
    const point = { t: snapshot.capturedAt ?? Date.now(), cpu: metrics?.cpuPercent ?? null, ram: metrics?.ramPercent ?? null, temp: metrics?.temperatureC ?? null, fps, battery: metrics?.batteryPercent ?? null }
    setState({ status: 'live', metrics, health: computeHealth(metrics), alerts: buildAlerts(metrics), history: [...state.history, point].slice(-MAX_HISTORY), error: null, lastUpdatedAt: point.t })
  } catch (error) {
    if (token === generation) setState({ status: 'error', metrics: null, health: null, error: error?.message ?? 'Sampling failed.' })
  } finally { sampling = false }
  return state
}

async function loop(token) {
  if (!running || !appActive || token !== generation) return
  await sampleNow()
  if (running && appActive && token === generation) timer = setTimeout(() => loop(token), state.intervalMs)
}

function handleAppState(next) {
  appActive = next === 'active'
  clearTimeout(timer); timer = null; generation++
  if (!appActive) setState({ status: 'paused', metrics: state.metrics ? { ...state.metrics, fps: null } : null })
  else if (running) loop(generation)
}

export function startMonitor({ intervalMs = 5000 } = {}) {
  if (running) return
  if (!deviceNative.isAvailable) { setState({ status: 'unavailable', error: 'Native device module is not present.' }); return }
  running = true; generation++
  appActive = AppState.currentState == null || AppState.currentState === 'active'
  setState({ intervalMs: Math.max(2000, Math.min(30000, intervalMs)), status: appActive ? 'sampling' : 'paused' })
  subscription = AppState.addEventListener('change', handleAppState)
  loop(generation)
}

export function stopMonitor() {
  running = false; generation++
  clearTimeout(timer); timer = null
  subscription?.remove(); subscription = null
  setState({ status: 'idle' })
}

export const isMonitoring = () => running && appActive
