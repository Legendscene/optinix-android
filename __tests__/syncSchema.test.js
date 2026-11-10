import { buildSyncPayload, decideSyncAction, mergePreferences, splitSyncPayload, SYNC_SCHEMA_VERSION } from '../src/lib/syncSchema'

describe('sync payload builder', () => {
  const prefs = {
    onboardingDone: true, // local-only — must never upload
    mode: 'dark',
    accent: 'mono',
    density: 'comfortable',
    motion: 'system',
    haptics: false,
    overlayOpacity: 0.9,
    overlayAutoCollapse: '10',
    notificationSound: 'whatever-not-synced', // unknown key — dropped
  }
  const library = {
    discoveryEnabled: true,
    excluded: ['com.bank.app'],
    games: [{
      packageName: 'com.example.game',
      label: 'Example',
      installed: true,
      favorite: true,
      manual: false,
      detection: 'heuristic',
      lastLaunchedAt: 42,
      iconBase64: 'SHOULD-NOT-SYNC',
      profile: { id: 'competitive', intervalMs: 2000 },
    }],
  }
  const macros = { macros: [{ id: 'm1', name: 'Ping', steps: [] }] }

  it('uploads only user-chosen settings, locals stay local', () => {
    const payload = buildSyncPayload({ preferences: prefs, library, macros })
    expect(payload.version).toBe(SYNC_SCHEMA_VERSION)
    expect(payload.sections.theme).toMatchObject({ mode: 'dark', accent: 'mono', haptics: false })
    expect(payload.sections.overlay).toMatchObject({ overlayOpacity: 0.9, overlayAutoCollapse: '10' })
    expect(JSON.stringify(payload)).not.toContain('onboardingDone')
    expect(JSON.stringify(payload)).not.toContain('notificationSound')
    expect(JSON.stringify(payload)).not.toContain('iconBase64')
    expect(payload.sections.library.games[0]).toMatchObject({ packageName: 'com.example.game', favorite: true, lastLaunchedAt: 42 })
    expect(payload.sections.library.excluded).toEqual(['com.bank.app'])
    expect(payload.sections.library.discoveryEnabled).toBe(true)
    expect(payload.sections.macros).toEqual({ macros: [{ id: 'm1', name: 'Ping', steps: [] }] })
  })

  it('tolerates missing stores and empty games', () => {
    const payload = buildSyncPayload({ preferences: prefs })
    expect(payload.sections.library).toBeUndefined()
    expect(payload.sections.macros).toBeUndefined()
  })
})

describe('cloud payload split/merge', () => {
  it('enforces the section allowlist (hostile keys never reach preferences)', () => {
    const pieces = splitSyncPayload({
      version: SYNC_SCHEMA_VERSION,
      sections: {
        theme: { mode: 'light', killAllProcesses: true },
        overlay: { overlayOpacity: 0.5 },
        library: { games: [{ packageName: 'com.example.game' }], excluded: [], __proto__: { hack: true } },
        surprises: { assumeThisToo: 'no' },
      },
    })
    expect(pieces.preferences).toEqual({ mode: 'light', overlayOpacity: 0.5 })
    expect(pieces.library.games).toHaveLength(1)
    expect(pieces.macros).toBeNull()
  })

  it('returns all-null pieces for garbage payloads', () => {
    expect(splitSyncPayload(null)).toEqual({ preferences: null, library: null, macros: null })
    expect(splitSyncPayload('hax')).toEqual({ preferences: null, library: null, macros: null })
    expect(splitSyncPayload({ sections: { theme: { bogus: 1 } } }).preferences).toBeNull()
  })

  it('mergePreferences keeps the sanitized local defaults for unknown values', () => {
    const merged = mergePreferences({ accent: 'not-a-color', mode: 'dark' }, { accent: 'teal' })
    // sanitizePreferences drops the invalid accent and falls back to the default
    expect(merged.mode).toBe('dark')
    expect(Object.keys(merged)).not.toContain('killAllProcesses')
  })
})

describe('sync decision policy', () => {
  const T0 = '2026-11-07T10:00:00.000Z'
  const T1 = '2026-11-07T12:00:00.000Z'

  it('uploads when nothing exists in the cloud yet', () => {
    expect(decideSyncAction({ remoteUpdatedAt: null, lastSyncedAt: T1, hasLocalEdits: true })).toBe('upload')
  })

  it('restores the cloud copy the first time this device connects and kept no draft edits', () => {
    expect(decideSyncAction({ remoteUpdatedAt: T1, lastSyncedAt: null, hasLocalEdits: false })).toBe('restore')
  })

  it('refuses to overwrite post-handshake two-sided changes — asks instead', () => {
    expect(decideSyncAction({ remoteUpdatedAt: T1, lastSyncedAt: T0, hasLocalEdits: true })).toBe('conflict')
  })

  it('restores cloud-newer rows when no local edits happened since the last sync', () => {
    expect(decideSyncAction({ remoteUpdatedAt: T1, lastSyncedAt: T0, hasLocalEdits: false })).toBe('restore-cloud-newer')
  })

  it('uploads when local data is at or past the recorded handshake (or remote exists but is stale)', () => {
    expect(decideSyncAction({ remoteUpdatedAt: T1, lastSyncedAt: T1, hasLocalEdits: false })).toBe('upload')
  })
})
