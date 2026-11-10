import { perAppControlsAvailable, startupConsequences, startupSupportCopy } from '../src/lib/startupOem'

describe('startupOem', () => {
  test('a resolvable Realme/ColorOS manager yields supported copy with real steps', () => {
    const copy = startupSupportCopy({ supported: true, manufacturer: 'Realme-RMX3998', managerLabel: 'Phone Manager' })
    expect(copy.tone).toBe('supported')
    expect(copy.title).toBe('Phone Manager found on your phone')
    expect(copy.steps.join(' ')).toContain('Startup manager')
    expect(copy.managerLabel).toBe('Phone Manager')
  })

  test('unsupported devices get the honest unsupported state, never a fake toggle', () => {
    const copy = startupSupportCopy({ supported: false, manufacturer: 'Generic Corp', managerLabel: null })
    expect(copy.tone).toBe('unsupported')
    expect(copy.title).toBe('Startup control is not supported on this device')
    expect(copy.body).toMatch(/will not fake a toggle/)
    expect(JSON.stringify(copy)).not.toMatch(/Auto-start count|enabled: true/i)
  })

  test('a missing native result is reported as unknown, not invented', () => {
    const copy = startupSupportCopy(null)
    expect(copy.tone).toBe('unknown')
    expect(copy.managerLabel).toBe(null)
  })

  test('vendor instructions key off manufacturer spelling tolerantly', () => {
    expect(startupSupportCopy({ supported: true, manufacturer: 'Xiaomi', managerLabel: 'Security' }).steps.join(' '))
      .toContain('Autostart')
    expect(startupSupportCopy({ supported: true, manufacturer: 'Samsung', managerLabel: null }).steps.join(' '))
      .toContain('Sleeping apps')
  })

  test('consequences disclose the user impact of blocking auto-start', () => {
    const list = startupConsequences()
    expect(list.some((line) => line.includes('notifications'))).toBe(true)
  })

  test('per-app manage actions depend on a resolvable vendor page', () => {
    expect(perAppControlsAvailable({ supported: true, managerLabel: 'Security' })).toBe(true)
    expect(perAppControlsAvailable({ supported: false, managerLabel: null })).toBe(false)
    expect(perAppControlsAvailable(null)).toBe(false)
  })
})
