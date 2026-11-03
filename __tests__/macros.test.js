import { macroDuration, newMacro, previewMacro, validateMacro } from '../src/lib/macros'
import { compareDiagnostics, validateTarget } from '../src/lib/networkDiagnostics'

describe('utility macro contract', () => {
  it('validates a bounded sequence and previews the actual steps', () => {
    const macro = newMacro()
    expect(validateMacro(macro)).toEqual([])
    expect(macroDuration(macro)).toBe(1150)
    expect(previewMacro(macro)).toEqual(['1. Wait 1000 ms', '2. Session marker: Ready'])
  })
  it.each([0, -1, 21, Infinity, 1.2])('rejects repeat count %s', (repeats) => {
    expect(validateMacro({ ...newMacro(), repeats }).length).toBeGreaterThan(0)
  })
  it('rejects unsupported touch input and runtime overflow', () => {
    expect(validateMacro({ ...newMacro(), steps: [{ type: 'tap', x: 1, y: 1 }] }).join(' ')).toContain('cross-app input')
    expect(validateMacro({ ...newMacro(), repeats: 20, steps: [{ type: 'delay', durationMs: 60000 }] }).join(' ')).toContain('10 minutes')
  })
  it('rejects empty or malformed steps instead of silently executing a different macro', () => {
    expect(validateMacro({ ...newMacro(), steps: [] }).length).toBeGreaterThan(0)
    expect(validateMacro({ ...newMacro(), steps: [{ type: 'delay', durationMs: NaN }] }).length).toBeGreaterThan(0)
  })
})

describe('diagnostic attribution', () => {
  it('allows explicit HTTPS endpoints but rejects credentials and other protocols', () => {
    expect(validateTarget('https://example.org/health')).toBeNull()
    for (const url of ['http://example.org', 'https://user:secret@example.org', 'https://example.org/#secret', 'file:///private']) expect(validateTarget(url)).not.toBeNull()
  })
  it('requires measured comparable endpoints and transports', () => {
    const before = { target: 'https://example.org', transport: 'wifi', averageMs: 20 }
    expect(compareDiagnostics(before, { ...before, averageMs: 15 })).toMatchObject({ comparable: true, latencyDeltaMs: -5, jitterDeltaMs: null })
    expect(compareDiagnostics(before, { ...before, transport: 'cellular' }).comparable).toBe(false)
    expect(compareDiagnostics(before, { ...before, averageMs: null }).comparable).toBe(false)
  })
})
