import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'optinix:runs:v1'
const MAX_RUNS = 60

let cache = null

export async function loadRuns() {
  if (cache) return cache
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache
}

export async function appendRun(run) {
  const runs = await loadRuns()
  const trimmed = [run, ...runs].slice(0, MAX_RUNS)
  cache = trimmed
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Persistence is best-effort; the in-memory list stays usable.
  }
  return trimmed
}

export async function clearRuns() {
  cache = []
  try {
    await AsyncStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  return cache
}

export function summarizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return { total: 0, applied: 0, measured: 0, lastRunAt: null, byEngine: {} }
  }
  let applied = 0
  let measured = 0
  const byEngine = {}
  for (const run of runs) {
    const engineId = run?.engineId ?? 'unknown'
    byEngine[engineId] = (byEngine[engineId] ?? 0) + 1
    if (run?.ok) applied += 1
    if (run?.delta) measured += 1
  }
  return {
    total: runs.length,
    applied,
    measured,
    lastRunAt: runs[0]?.finishedAt ?? null,
    byEngine,
  }
}
