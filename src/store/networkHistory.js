import { createPersistentStore } from './persistentStore'

export const networkHistory = createPersistentStore('optinix:network:v1', { runs: [] }, (raw) => ({ runs: (Array.isArray(raw?.runs) ? raw.runs : []).filter((item) => item && typeof item.target === 'string' && Number.isFinite(item.finishedAt)).slice(0, 40) }))
export const useNetworkHistory = networkHistory.useStore
export const pruneNetworkHistory = (days) => networkHistory.change((data) => ({ runs: data.runs.filter((run) => run.finishedAt >= Date.now() - days * 86400000) }))
export const saveDiagnostic = (run, days = 30) => networkHistory.change((data) => ({ runs: [{ ...run, id: `${run.finishedAt}-${Math.random().toString(36).slice(2, 8)}` }, ...data.runs].filter((item) => item.finishedAt >= Date.now() - days * 86400000).slice(0, 40) }))
