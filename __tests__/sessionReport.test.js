import { sessionReportLines, sessionShareText } from '../src/lib/sessionReport'

describe('Session report sharing', () => {
  const entry = {
    gameLabel: 'Township',
    profileName: 'Competitive',
    durationMs: 3_725_000,
    cpuAverage: 41.2,
    ramAverage: 72.5,
    tempPeak: 44.1,
    temperatureSource: 'battery sensor',
    interrupted: false,
    reason: 'user stopped',
    startedAt: 1_700_000_000_000,
  }

  it('formats only measured session values', () => {
    const lines = Object.fromEntries(sessionReportLines(entry))
    expect(lines.Game).toBe('Township')
    expect(lines.Profile).toBe('Competitive')
    expect(lines['Measured time']).toBe('1h 2m')
    expect(lines['CPU average']).toBe('41%')
    expect(lines['RAM average']).toBe('73%')
    expect(lines['Peak temperature']).toBe('44.1°C')
    expect(lines.Ended).toBe('user stopped')
  })

  it('keeps missing readings honest instead of inventing numbers', () => {
    const lines = Object.fromEntries(sessionReportLines({}))
    expect(lines.Game).toBe('Gaming session')
    expect(lines['Measured time']).toBe('--')
    expect(lines['CPU average']).toBe('--')
    expect(lines['Peak temperature']).toBe('--')
    expect(lines['Temperature source']).toBe('unavailable')
  })

  it('states the game-FPS limitation in the shared message', () => {
    const text = sessionShareText(entry)
    expect(text).toContain('Optinix gaming session')
    expect(text).toContain('Game: Township')
    expect(text).toMatch(/Game FPS is not measurable/i)
  })

  it('marks interrupted sessions as ending at the last checkpoint', () => {
    expect(Object.fromEntries(sessionReportLines({ ...entry, interrupted: true })).Ended).toMatch(/last checkpoint/)
  })
})
