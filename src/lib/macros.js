export const MACRO_ACTIONS = [
  { id: 'delay', label: 'Wait', detail: 'Wait for the configured duration.' },
  { id: 'haptic', label: 'Haptic cue', detail: 'Send a short device vibration, if haptics are enabled.' },
  { id: 'marker', label: 'Session marker', detail: 'Record a named moment in the local session.' },
  { id: 'pause_timer', label: 'Pause timer', detail: 'Pause the Optinix session timer.' },
  { id: 'resume_timer', label: 'Resume timer', detail: 'Resume the Optinix session timer.' },
  { id: 'collapse_overlay', label: 'Collapse HUD', detail: 'Collapse the Optinix control center.' },
]

export function macroDuration(macro) {
  if (!Array.isArray(macro?.steps)) return null
  const total = macro.steps.reduce((sum, step) => sum + (step?.type === 'delay' ? Number(step.durationMs) : 150), 0) * Number(macro.repeats)
  return Number.isFinite(total) ? total : null
}

export function validateMacro(macro) {
  const errors = []
  if (typeof macro?.name !== 'string' || !macro.name.trim() || macro.name.trim().length > 60) errors.push('Name must contain 1–60 characters.')
  if (typeof macro?.category !== 'string' || !macro.category.trim() || macro.category.length > 40) errors.push('Choose a category of 1–40 characters.')
  if (!Number.isInteger(macro?.repeats) || macro.repeats < 1 || macro.repeats > 20) errors.push('Repeat count must be a whole number from 1 to 20.')
  if (!Array.isArray(macro?.steps) || macro.steps.length === 0 || macro.steps.length > 30) errors.push('A macro must contain 1–30 steps.')
  for (const [index, step] of (Array.isArray(macro?.steps) ? macro.steps : []).entries()) {
    if (!MACRO_ACTIONS.some((item) => item.id === step?.type)) errors.push(`Step ${index + 1}: cross-app input and unknown actions are unsupported.`)
    if (step?.type === 'delay' && (!Number.isInteger(step.durationMs) || step.durationMs < 100 || step.durationMs > 60000)) errors.push(`Step ${index + 1}: wait must be 100–60,000 ms.`)
    if (step?.type === 'marker' && (typeof step.label !== 'string' || !step.label.trim() || step.label.length > 80)) errors.push(`Step ${index + 1}: marker needs a label of 1–80 characters.`)
  }
  const duration = macroDuration(macro)
  if (duration == null || duration > 600000) errors.push('Total scheduled runtime must be at most 10 minutes.')
  return errors
}

export function previewMacro(macro) {
  return (macro.steps ?? []).map((step, index) => {
    const action = MACRO_ACTIONS.find((item) => item.id === step?.type)
    return `${index + 1}. ${action?.label ?? 'Unsupported action'}${step?.type === 'delay' ? ` ${step.durationMs} ms` : step?.type === 'marker' ? `: ${step.label}` : ''}`
  })
}

export const newMacroId = () => `macro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
export const newMacro = () => ({ id: newMacroId(), name: 'New utility macro', category: 'Gaming', repeats: 1, steps: [{ type: 'delay', durationMs: 1000 }, { type: 'marker', label: 'Ready' }], updatedAt: Date.now() })
