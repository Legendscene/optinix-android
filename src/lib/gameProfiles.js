export const PROFILE_PRESETS = [
  { id: 'competitive', name: 'Competitive Gaming', short: 'Competitive', detail: 'A focused HUD with an optional Optinix DND rule. Game graphics stay under your control.', intervalMs: 2000, reminderMinutes: 30, dnd: true, overlay: true },
  { id: 'maximum', name: 'Maximum Supported Performance', short: 'Max Support', detail: 'Responsive monitoring. Use the game or manufacturer controls for performance mode; Optinix cannot change CPU/GPU limits.', intervalMs: 2000, reminderMinutes: 30, dnd: false, overlay: true },
  { id: 'balanced', name: 'Balanced', short: 'Balanced', detail: 'Quiet monitoring and a break reminder every 45 minutes.', intervalMs: 5000, reminderMinutes: 45, dnd: false, overlay: true },
  { id: 'battery', name: 'Battery Saver', short: 'Battery', detail: 'Less frequent Optinix sampling. System battery saver and game frame-rate settings remain manual.', intervalMs: 10000, reminderMinutes: 30, dnd: false, overlay: true },
  { id: 'streaming', name: 'Streaming', short: 'Streaming', detail: 'A minimal HUD with interruptions left unchanged. Capture is always started separately with consent.', intervalMs: 5000, reminderMinutes: 60, dnd: false, overlay: true },
  { id: 'custom', name: 'Custom Profile', short: 'Custom', detail: 'Choose supported Optinix controls for this game.', intervalMs: 5000, reminderMinutes: 0, dnd: false, overlay: true },
]

export function sanitizeProfile(raw) {
  const base = PROFILE_PRESETS.find((item) => item.id === raw?.id) ?? PROFILE_PRESETS[2]
  return {
    id: base.id,
    name: base.name,
    short: base.short,
    intervalMs: [2000, 5000, 10000].includes(raw?.intervalMs) ? raw.intervalMs : base.intervalMs,
    reminderMinutes: [0, 15, 30, 45, 60].includes(raw?.reminderMinutes) ? raw.reminderMinutes : base.reminderMinutes,
    dnd: typeof raw?.dnd === 'boolean' ? raw.dnd : base.dnd,
    overlay: typeof raw?.overlay === 'boolean' ? raw.overlay : base.overlay,
  }
}

export function profilePreview(profile) {
  const p = sanitizeProfile(profile)
  return [
    { key: 'sampling', label: 'HUD sampling', value: `${p.intervalMs / 1000}s`, status: 'app-owned' },
    { key: 'reminder', label: 'Break reminder', value: p.reminderMinutes ? `${p.reminderMinutes} minutes` : 'Off', status: 'app-owned' },
    { key: 'overlay', label: 'Floating HUD', value: p.overlay ? 'Enabled with overlay access' : 'Off', status: p.overlay ? 'permission' : 'app-owned' },
    { key: 'dnd', label: 'Optinix DND rule', value: p.dnd ? 'Enable for this session' : 'Leave user DND unchanged', status: p.dnd ? 'permission' : 'app-owned' },
    { key: 'hardware', label: 'Game FPS / CPU / GPU', value: 'Controlled by the game and manufacturer', status: 'user-action' },
  ]
}
