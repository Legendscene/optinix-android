import { CAPABILITY, createEngine, diffMetrics } from '../src/engines/base'
import { engines, getEngine, listEngines } from '../src/engines'
import { pickBoostCandidates, pickStorageHogs } from '../src/engines/appEngines'

describe('engine registry', () => {
  it('exposes unique engine ids', () => {
    const ids = engines.map((engine) => engine.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('memory-boost')
    expect(ids).toContain('game-boost')
    expect(ids).toContain('thermal-guard')
  })

  it('filters by category', () => {
    const gaming = listEngines({ category: 'gaming' })
    expect(gaming.map((engine) => engine.id).sort()).toEqual(['fps-monitor', 'game-boost'])
  })

  it('returns null for unknown engines', () => {
    expect(getEngine('nope')).toBe(null)
  })

  it('gives every engine a capability', () => {
    for (const engine of engines) {
      expect(Object.values(CAPABILITY)).toContain(engine.capability)
      expect(typeof engine.inspect).toBe('function')
    }
  })
})

describe('diffMetrics', () => {
  it('returns null when either side is missing', () => {
    expect(diffMetrics(null, { a: 1 })).toBe(null)
    expect(diffMetrics({ a: 1 }, null)).toBe(null)
  })

  it('diffs numeric fields and nulls the rest', () => {
    const delta = diffMetrics({ ram: 60, cpu: 20, label: 'x' }, { ram: 45, cpu: 30, label: 'y' })
    expect(delta.ram).toBe(-15)
    expect(delta.cpu).toBe(10)
    expect(delta.label).toBe(null)
  })
})

describe('createEngine', () => {
  it('runs measure, inspect, execute and measure again', async () => {
    let value = 10
    const measure = jest.fn(async () => ({ ram: value }))
    const engine = createEngine({
      id: 'test',
      name: 'Test',
      category: 'performance',
      description: 'test engine',
      measure: null,
      inspect: () => ({ found: true }),
      execute: () => {
        value = 4
        return { ok: true }
      },
    })

    const run = await engine.run({ measure })
    expect(measure).toHaveBeenCalledTimes(2)
    expect(run.inspection).toEqual({ found: true })
    expect(run.execution.ok).toBe(true)
    expect(run.delta.ram).toBe(-6)
    expect(run.ok).toBe(true)
  })

  it('skips execution in dry runs', async () => {
    const execute = jest.fn(() => ({ ok: true }))
    const engine = createEngine({
      id: 'dry',
      name: 'Dry',
      category: 'performance',
      description: 'dry',
      inspect: () => null,
      execute,
    })
    const run = await engine.run({ dryRun: true })
    expect(execute).not.toHaveBeenCalled()
    expect(run.execution).toBe(null)
  })

  it('marks monitor-only engines as unsupported to execute', async () => {
    const engine = createEngine({
      id: 'monitor',
      name: 'Monitor',
      category: 'network',
      description: 'monitor',
      inspect: () => ({ ok: true }),
    })
    const result = await engine.execute()
    expect(result.supported).toBe(false)
    expect(result.ok).toBe(false)
  })
})

describe('candidate pickers', () => {
  const recent = [
    { packageName: 'com.game', isSystem: false, totalTimeInForegroundMs: 500 },
    { packageName: 'com.system', isSystem: true, totalTimeInForegroundMs: 900 },
    { packageName: 'com.chat', isSystem: false, totalTimeInForegroundMs: 100 },
    { packageName: 'com.keep', isSystem: false, totalTimeInForegroundMs: 700 },
  ]

  it('drops system and excluded apps, then sorts by foreground time', () => {
    const picked = pickBoostCandidates(recent, { limit: 3, exclude: ['com.keep'] })
    expect(picked.map((app) => app.packageName)).toEqual(['com.game', 'com.chat'])
  })

  it('respects the limit', () => {
    expect(pickBoostCandidates(recent, { limit: 1 })).toHaveLength(1)
  })

  it('ranks only supported storage entries', () => {
    const ranked = pickStorageHogs([
      { packageName: 'a', supported: true, totalBytes: 10 },
      { packageName: 'b', supported: false, totalBytes: 900 },
      { packageName: 'c', supported: true, totalBytes: 50 },
    ])
    expect(ranked.map((entry) => entry.packageName)).toEqual(['c', 'a'])
  })
})
