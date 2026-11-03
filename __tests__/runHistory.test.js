import { summarizeRuns } from '../src/lib/runHistory'

describe('summarizeRuns', () => {
  it('handles empty input', () => {
    expect(summarizeRuns([])).toEqual({
      total: 0,
      applied: 0,
      measured: 0,
      lastRunAt: null,
      byEngine: {},
    })
  })

  it('counts applied and measured runs per engine', () => {
    const summary = summarizeRuns([
      { engineId: 'memory-boost', ok: true, delta: { ramPercent: -4 }, finishedAt: 300 },
      { engineId: 'memory-boost', ok: false, delta: null, finishedAt: 200 },
      { engineId: 'cache-clean', ok: true, delta: null, finishedAt: 100 },
    ])
    expect(summary.total).toBe(3)
    expect(summary.applied).toBe(2)
    expect(summary.measured).toBe(1)
    expect(summary.lastRunAt).toBe(300)
    expect(summary.byEngine).toEqual({ 'memory-boost': 2, 'cache-clean': 1 })
  })
})
