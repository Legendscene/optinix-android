import {
  buildAlerts,
  computeHealth,
  healthGrade,
  metricsFromSnapshot,
  pingQuality,
} from '../src/lib/insights'

describe('computeHealth', () => {
  it('returns null without measurements', () => {
    expect(computeHealth(null)).toBe(null)
    expect(computeHealth({})).toBe(null)
  })

  it('only counts battery when discharging', () => {
    expect(computeHealth({ batteryPercent: 4, batteryStatus: 'charging' })).toBe(null)
    const discharging = computeHealth({ batteryPercent: 4, batteryStatus: 'discharging' })
    expect(discharging).not.toBe(null)
    expect(discharging.score).toBeLessThan(100)
  })

  it('scores a healthy device highly', () => {
    const health = computeHealth({ cpuPercent: 12, ramPercent: 30, temperatureC: 32 })
    expect(health.score).toBe(100)
    expect(health.grade).toBe('excellent')
  })

  it('scores a loaded device poorly', () => {
    const health = computeHealth({
      cpuPercent: 95,
      ramPercent: 95,
      temperatureC: 62,
      storagePercent: 98,
      batteryPercent: 5,
      batteryStatus: 'discharging',
    })
    expect(health.score).toBeLessThan(10)
    expect(health.grade).toBe('poor')
    expect(health.penalties.map((entry) => entry.key).sort()).toEqual([
      'battery',
      'cpu',
      'ram',
      'storage',
      'thermal',
    ])
  })
})

describe('healthGrade', () => {
  it('maps score bands', () => {
    expect(healthGrade(null)).toBe('unknown')
    expect(healthGrade(90)).toBe('excellent')
    expect(healthGrade(75)).toBe('good')
    expect(healthGrade(55)).toBe('fair')
    expect(healthGrade(20)).toBe('poor')
  })
})

describe('pingQuality', () => {
  it('maps latency to quality', () => {
    expect(pingQuality(null)).toBe('unknown')
    expect(pingQuality(10)).toBe('good')
    expect(pingQuality(60)).toBe('fair')
    expect(pingQuality(120)).toBe('poor')
  })
})

describe('buildAlerts', () => {
  it('returns nothing for healthy metrics', () => {
    expect(buildAlerts({ cpuPercent: 10, ramPercent: 20 })).toEqual([])
  })

  it('flags warnings and criticals', () => {
    const warning = buildAlerts({ cpuPercent: 88 })
    expect(warning).toHaveLength(1)
    expect(warning[0].severity).toBe('warning')

    const critical = buildAlerts({ cpuPercent: 97 })
    expect(critical[0].severity).toBe('critical')
  })

  it('adds thermal and storage alerts', () => {
    const alerts = buildAlerts({
      temperatureC: 55,
      batteryTemperatureC: 46,
      storagePercent: 92,
      ramPercent: 90,
    })
    expect(alerts.map((alert) => alert.id).sort()).toEqual([
      'battery-thermal',
      'ram',
      'storage',
      'thermal',
    ])
  })
})

describe('metricsFromSnapshot', () => {
  it('returns null without a snapshot', () => {
    expect(metricsFromSnapshot(null)).toBe(null)
  })

  it('flattens the native snapshot', () => {
    const metrics = metricsFromSnapshot(
      {
        capturedAt: 123,
        cpu: { overall: 44.4, perCore: [40, 48] },
        memory: { percent: 55, usedBytes: 1000, totalBytes: 2000, availBytes: 1000 },
        storage: { percent: 70, usedBytes: 700, totalBytes: 1000, freeBytes: 300 },
        battery: { percent: 80, status: 'charging', temperatureC: 33 },
        thermal: { celsius: 41, statusLabel: 'light', zones: [] },
        display: { refreshRate: 120 },
        network: { type: 'wifi', rssi: -50 },
        device: { model: 'Test' },
        uptimeMs: 999,
      },
      60,
    )
    expect(metrics.cpuPercent).toBe(44.4)
    expect(metrics.ramPercent).toBe(55)
    expect(metrics.fps).toBe(60)
    expect(metrics.temperatureC).toBe(41)
    expect(metrics.networkType).toBe('wifi')
    expect(metrics.device.model).toBe('Test')
  })
})
