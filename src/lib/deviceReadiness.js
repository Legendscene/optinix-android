/**
 * Device readiness audit.
 *
 * Every entry below is derived from a capability the native modules actually
 * probe on this phone (overlay access, usage access, notification policy
 * access, WRITE_SETTINGS, battery exemption, vendor auto-start manager).
 * Nothing is assumed from the model name, and no check is invented: when a
 * probe is unsupported the row says so instead of pretending it passed.
 */

export const HONEST_LIMITS = [
  {
    title: 'Game FPS',
    detail:
      'Android does not expose another app\'s frames, so game FPS stays "--". Optinix shows its own measured readings only.',
  },
  {
    title: 'CPU / GPU clocks',
    detail:
      'Changing governors needs root. Optinix never claims a scheduling change it did not apply.',
  },
  {
    title: 'Refresh rate',
    detail:
      'Writing the display mode is unreliable across OEMs, so Optinix opens Display settings instead of faking a switch.',
  },
  {
    title: 'Other apps',
    detail:
      'Android blocks clearing another app\'s cache, force-stopping it or tapping inside it. Optinix refuses those actions rather than simulating them.',
  },
]

const SETTINGS = (label, target) => ({ label, kind: 'settings', target })

/**
 * @param {object} input
 * @param {object} input.capabilities  `getCapabilities()` from the overlay module
 * @param {object} input.permissions   `getPermissionState()` from the apps module
 * @param {object|null} input.startup  `getStartupSupport()` from the apps module
 * @param {object} input.preferences   app preferences (overlay visibility mode)
 */
export function buildReadiness({ capabilities = {}, permissions = {}, startup = null, preferences = {} } = {}) {
  const caps = capabilities ?? {}
  const perms = permissions ?? {}
  const notificationMode = preferences?.overlayVisibility === 'notification'
  const checks = []

  checks.push({
    id: 'overlay',
    group: 'Game HUD',
    title: 'Draw over other apps',
    detail: caps.overlayReason || 'Lets the edge handle and the assistant panel float above your game.',
    required: true,
    state: caps.overlay ? 'ok' : 'todo',
    action: caps.overlay ? null : SETTINGS('Allow overlay', 'overlay'),
  })
  checks.push({
    id: 'usage',
    group: 'Game HUD',
    title: 'Usage access',
    detail: 'Detects which library game is in front so the HUD only appears over games.',
    required: true,
    state: caps.usageAccess || perms.usageAccess ? 'ok' : 'todo',
    action: caps.usageAccess || perms.usageAccess ? null : SETTINGS('Allow access', 'usage'),
  })
  checks.push({
    id: 'notifications',
    group: 'Game HUD',
    title: 'Session notification',
    detail: notificationMode
      ? 'Needed in Notification-only mode: it is the way back to the HUD after minimizing.'
      : 'Optional. Only used when you pick Notification-only mode or need a session reminder.',
    required: notificationMode,
    state: caps.notifications ? 'ok' : notificationMode ? 'todo' : 'todo',
    action: caps.notifications ? null : SETTINGS('Open notifications', 'notifications'),
  })

  checks.push({
    id: 'dnd',
    group: 'System controls',
    title: 'Do Not Disturb access',
    detail: caps.dndSupported === false
      ? 'This Android version does not expose notification policy access.'
      : 'Lets the DND tool in the panel and per-game profiles silence alerts during a session.',
    required: false,
    state: caps.dndSupported === false ? 'na' : caps.dndAccess ? 'ok' : 'todo',
    action: caps.dndSupported === false || caps.dndAccess ? null : SETTINGS('Allow DND', 'dnd-access'),
  })
  checks.push({
    id: 'write',
    group: 'System controls',
    title: 'Modify system settings',
    detail: 'Required for the panel\'s brightness slider and rotation lock. Other tools work without it.',
    required: false,
    state: caps.writeSettings ? 'ok' : 'todo',
    action: caps.writeSettings ? null : SETTINGS('Allow changes', 'write'),
  })
  checks.push({
    id: 'battery',
    group: 'System controls',
    title: 'Ignore battery optimisation',
    detail: 'Stops Realme/ASUS-class app freezing from killing a session timer mid-game.',
    required: false,
    state: perms.batteryOptimizationExempt ? 'ok' : 'todo',
    action: perms.batteryOptimizationExempt ? null : { label: 'Request', kind: 'exempt' },
  })
  checks.push({
    id: 'startup',
    group: 'This phone',
    title: startup?.managerLabel ? `Auto-start: ${startup.managerLabel}` : 'Vendor auto-start manager',
    detail: startup?.supported
      ? 'This phone exposes a per-app auto-start page. Optinix opens it directly; nothing is changed silently.'
      : 'No supported vendor auto-start manager was found on this phone. Optinix does not simulate one.',
    required: false,
    state: startup?.supported ? 'ok' : 'na',
    action: startup?.supported ? { label: 'Open', kind: 'startup' } : null,
  })

  const required = checks.filter((check) => check.required && check.state !== 'na')
  const passed = required.filter((check) => check.state === 'ok').length
  const total = required.length
  const pending = total - passed
  const advisory = checks.filter((check) => !check.required && check.state === 'todo').length

  return {
    checks,
    passed,
    total,
    pending,
    advisory,
    headline: pending === 0
      ? 'Every required permission is enabled on this phone.'
      : `${pending} of ${total} required steps remaining before the HUD works fully.`,
  }
}

export function groupChecks(checks = []) {
  const order = ['Game HUD', 'System controls', 'This phone']
  const groups = new Map()
  for (const check of checks) {
    const key = check.group ?? 'Other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(check)
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const left = order.indexOf(a[0])
      const right = order.indexOf(b[0])
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right)
    })
    .map(([title, items]) => ({ title, items }))
}
