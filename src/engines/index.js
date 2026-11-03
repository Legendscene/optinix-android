import { CAPABILITY, createEngine, diffMetrics, round2 } from './base'
import {
  batteryAuditEngine,
  deviceScanEngine,
  fpsMonitorEngine,
  networkDiagnoseEngine,
  storageAuditEngine,
  thermalGuardEngine,
} from './systemEngines'
import {
  appUsageEngine,
  cacheCleanEngine,
  gameBoostEngine,
  memoryBoostEngine,
} from './appEngines'

export const engines = [
  deviceScanEngine,
  memoryBoostEngine,
  cacheCleanEngine,
  gameBoostEngine,
  fpsMonitorEngine,
  thermalGuardEngine,
  batteryAuditEngine,
  networkDiagnoseEngine,
  storageAuditEngine,
  appUsageEngine,
]

export const CATEGORY_ORDER = ['performance', 'gaming', 'storage', 'network', 'battery', 'thermal']

export function listEngines({ category } = {}) {
  if (!category) return engines
  return engines.filter((engine) => engine.category === category)
}

export function getEngine(id) {
  return engines.find((engine) => engine.id === id) ?? null
}

export async function runEngine(id, options = {}) {
  const engine = getEngine(id)
  if (!engine) throw new Error(`Unknown engine: ${id}`)
  return engine.run(options)
}

export async function runEngines(ids, options = {}) {
  const results = []
  for (const id of ids) {
    results.push(await runEngine(id, options))
  }
  return results
}

export { CAPABILITY, createEngine, diffMetrics, round2 }
