export function validateTarget(value) {
  if (typeof value !== 'string' || value.length > 300 || /\s/.test(value)) return 'Use an HTTPS URL of at most 300 characters, without spaces.'
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) return 'Use HTTPS without credentials or a URL fragment.'
    return null
  } catch { return 'Enter a valid HTTPS diagnostic endpoint.' }
}

export function compareDiagnostics(before, after) {
  if (!before || !after || before.target !== after.target || before.transport !== after.transport) return { comparable: false, reason: 'Choose results from the same endpoint and transport.' }
  if (![before.averageMs, after.averageMs].every((value) => typeof value === 'number' && Number.isFinite(value))) return { comparable: false, reason: 'Both runs need successful measured samples.' }
  return { comparable: true, latencyDeltaMs: after.averageMs - before.averageMs, jitterDeltaMs: typeof before.jitterMs === 'number' && typeof after.jitterMs === 'number' ? after.jitterMs - before.jitterMs : null }
}

export const milliseconds = (value) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ms` : '--'
