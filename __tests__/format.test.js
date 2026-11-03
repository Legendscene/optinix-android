import {
  clamp,
  formatBytes,
  formatCount,
  formatDuration,
  formatPercent,
  formatRate,
  formatTemperature,
  relativeTime,
} from '../src/lib/format'

describe('format helpers', () => {
  it('renders unknown values as --', () => {
    expect(formatBytes(null)).toBe('--')
    expect(formatPercent(undefined)).toBe('--')
    expect(formatTemperature(null)).toBe('--')
    expect(formatDuration(undefined)).toBe('--')
    expect(formatCount(null)).toBe('--')
    expect(formatRate(null)).toBe('--')
  })

  it('formats bytes using binary units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1024 ** 3 * 1.5)).toBe('1.5 GB')
  })

  it('formats percentages and temperatures', () => {
    expect(formatPercent(42.4)).toBe('42%')
    expect(formatPercent(42.46, 1)).toBe('42.5%')
    expect(formatTemperature(38.25)).toBe('38.3°C')
  })

  it('formats durations', () => {
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(125_000)).toBe('2m 5s')
    expect(formatDuration(3_725_000)).toBe('1h 2m')
  })

  it('formats rates', () => {
    expect(formatRate(850)).toBe('850 Kbps')
    expect(formatRate(2400)).toBe('2.4 Mbps')
  })

  it('formats relative time', () => {
    const now = 1_700_000_000_000
    expect(relativeTime(now, now)).toBe('just now')
    expect(relativeTime(now - 30_000, now)).toBe('30s ago')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago')
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe('2h ago')
    expect(relativeTime(0, now)).toBe('never')
  })

  it('clamps values', () => {
    expect(clamp(120, 0, 100)).toBe(100)
    expect(clamp(-4, 0, 100)).toBe(0)
    expect(clamp(null, 0, 100)).toBe(null)
  })
})
