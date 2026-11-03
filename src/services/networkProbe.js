const DEFAULT_URL = 'https://connectivitycheck.gstatic.com/generate_204'

export function summarizeLatency(samples) {
  const valid = samples.filter((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  if (valid.length === 0) return null
  const avg = valid.reduce((sum, value) => sum + value, 0) / valid.length
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const jitter = valid.length > 1
    ? valid.slice(1).reduce((sum, value, index) => sum + Math.abs(value - valid[index]), 0) / (valid.length - 1)
    : null
  return {
    avgMs: Math.round(avg * 10) / 10,
    minMs: Math.round(min * 10) / 10,
    maxMs: Math.round(max * 10) / 10,
    jitterMs: jitter == null ? null : Math.round(jitter * 10) / 10,
    samples: valid.length,
  }
}

async function probeOnce(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
    return response.ok ? Date.now() - startedAt : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function probeLatency({ url = DEFAULT_URL, samples = 3, timeoutMs = 2500 } = {}) {
  const results = []
  const count = Number.isFinite(samples) ? Math.max(1, Math.min(10, Math.floor(samples))) : 3
  for (let index = 0; index < count; index += 1) {
    const value = await probeOnce(url, timeoutMs)
    if (value != null) results.push(value)
  }
  return summarizeLatency(results)
}

export default probeLatency
