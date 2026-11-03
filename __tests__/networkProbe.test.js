import { summarizeLatency } from '../src/services/networkProbe'

describe('summarizeLatency', () => {
  it('returns null when no sample succeeded', () => {
    expect(summarizeLatency([])).toBe(null)
    expect(summarizeLatency([null, undefined, Number.NaN])).toBe(null)
  })

  it('computes average, range and jitter', () => {
    const summary = summarizeLatency([10, 20, 30])
    expect(summary.avgMs).toBe(20)
    expect(summary.minMs).toBe(10)
    expect(summary.maxMs).toBe(30)
    expect(summary.jitterMs).toBe(10)
    expect(summary.samples).toBe(3)
  })

  it('ignores failed samples', () => {
    const summary = summarizeLatency([null, 40])
    expect(summary.samples).toBe(1)
    expect(summary.avgMs).toBe(40)
    expect(summary.jitterMs).toBe(null)
  })
})
