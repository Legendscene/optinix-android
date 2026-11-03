export const CAPABILITY = {
  MONITOR: 'monitor',
  APPLY: 'apply',
  SETTINGS: 'settings',
}

export function round2(value) {
  return Math.round(value * 100) / 100
}

export function diffMetrics(before, after) {
  if (!before || !after) return null
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const delta = {}
  for (const key of keys) {
    const a = before[key]
    const b = after[key]
    if (
      typeof a === 'number' &&
      typeof b === 'number' &&
      Number.isFinite(a) &&
      Number.isFinite(b)
    ) {
      delta[key] = round2(b - a)
    } else {
      delta[key] = null
    }
  }
  return delta
}

export function createEngine(config) {
  const { id, name, category, description, capability = CAPABILITY.MONITOR, requires = [] } = config

  const engine = {
    id,
    name,
    category,
    description,
    capability,
    requires,
    inspect(ctx = {}) {
      return config.inspect ? config.inspect(ctx) : null
    },
    execute(ctx = {}) {
      if (!config.execute) {
        return { ok: false, supported: false, reason: 'monitor-only' }
      }
      return config.execute(ctx)
    },
    async run(ctx = {}) {
      const startedAt = Date.now()
      const { measure } = ctx
      const before = measure ? await measure() : null
      const inspection = await engine.inspect(ctx)
      const execution = ctx.dryRun || (capability === CAPABILITY.MONITOR && !config.execute) ? null : await engine.execute({ ...ctx, inspection, before })
      const after = measure ? await measure() : null

      return {
        engineId: id,
        name,
        category,
        startedAt,
        finishedAt: Date.now(),
        before,
        after,
        inspection,
        execution,
        capability,
        delta: diffMetrics(before, after),
        ok: execution ? execution.ok !== false : true,
      }
    },
  }

  return engine
}
