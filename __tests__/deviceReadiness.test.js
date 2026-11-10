import { buildReadiness, groupChecks, HONEST_LIMITS } from '../src/lib/deviceReadiness'

const READY = {
  capabilities: { overlay: true, usageAccess: true, notifications: true, dndSupported: true, dndAccess: true, writeSettings: true },
  permissions: { batteryOptimizationExempt: true },
  startup: { supported: true, managerLabel: 'Realme auto-start' },
  preferences: { overlayVisibility: 'edge' },
}

describe('Device readiness audit', () => {
  it('reports a fully enabled phone as ready', () => {
    const readiness = buildReadiness(READY)
    expect(readiness.pending).toBe(0)
    expect(readiness.passed).toBe(readiness.total)
    expect(readiness.headline).toMatch(/every required permission/i)
    expect(readiness.checks.every((check) => check.state !== 'todo')).toBe(true)
  })

  it('counts only required checks as blocking and links the real settings route', () => {
    const readiness = buildReadiness({ ...READY, capabilities: { ...READY.capabilities, overlay: false, usageAccess: false } })
    expect(readiness.pending).toBe(2)
    const overlay = readiness.checks.find((check) => check.id === 'overlay')
    expect(overlay.state).toBe('todo')
    expect(overlay.action).toMatchObject({ kind: 'settings', target: 'overlay' })
    expect(overlay.detail).toMatch(/float above your game/i)
  })

  it('treats the session notification as required only in notification-only mode', () => {
    const capabilities = { ...READY.capabilities, notifications: false }
    const edge = buildReadiness({ ...READY, capabilities, preferences: { overlayVisibility: 'edge' } })
    expect(edge.pending).toBe(0)
    const notificationMode = buildReadiness({ ...READY, capabilities, preferences: { overlayVisibility: 'notification' } })
    expect(notificationMode.pending).toBe(1)
    expect(notificationMode.checks.find((check) => check.id === 'notifications').action).toMatchObject({ target: 'notifications' })
  })

  it('marks unsupported probes as N/A instead of failed', () => {
    const readiness = buildReadiness({
      ...READY,
      capabilities: { ...READY.capabilities, dndSupported: false, dndAccess: false },
      startup: { supported: false, managerLabel: null },
    })
    expect(readiness.checks.find((check) => check.id === 'dnd').state).toBe('na')
    expect(readiness.checks.find((check) => check.id === 'startup').state).toBe('na')
    expect(readiness.pending).toBe(0)
    expect(readiness.checks.find((check) => check.id === 'startup').detail).toMatch(/does not simulate/i)
  })

  it('warns about optional controls without blocking the score', () => {
    const readiness = buildReadiness({ ...READY, permissions: { batteryOptimizationExempt: false }, capabilities: { ...READY.capabilities, writeSettings: false } })
    expect(readiness.pending).toBe(0)
    expect(readiness.advisory).toBe(2)
  })

  it('groups checks in screen order', () => {
    const groups = groupChecks(buildReadiness(READY).checks)
    expect(groups.map((group) => group.title)).toEqual(['Game HUD', 'System controls', 'This phone'])
  })

  it('never claims a capability the app cannot have', () => {
    const titles = HONEST_LIMITS.map((limit) => limit.title)
    expect(titles).toEqual(['Game FPS', 'CPU / GPU clocks', 'Refresh rate', 'Other apps'])
  })
})
