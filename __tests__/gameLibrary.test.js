import { discoverGames, gameLibrary, mergeDiscovered, sanitizeLibrary, selectGames } from '../src/store/gameLibrary'
import { sanitizeProfile } from '../src/lib/gameProfiles'
import appsNative from '../src/native/apps'

jest.mock('../src/native/apps', () => ({
  __esModule: true,
  isAppsNativeAvailable: true,
  default: { isAvailable: true, getInstalledApps: jest.fn() },
}))

describe('Game Space persistence contract', () => {
  const saved = [{ packageName: 'com.example.game', label: 'Game', favorite: true, manual: true, lastLaunchedAt: 42, profile: { id: 'custom', dnd: true, overlay: false, intervalMs: 10000 } }]
  it('preserves user choices across discovery and marks removed games unavailable', () => {
    const absent = sanitizeLibrary({ games: mergeDiscovered(saved, []) }).games[0]
    expect(absent).toMatchObject({ favorite: true, manual: true, installed: false, lastLaunchedAt: 42 })
    expect(absent.profile).toMatchObject({ id: 'custom', dnd: true, overlay: false, intervalMs: 10000 })
    const restored = sanitizeLibrary({ games: mergeDiscovered([absent], [{ packageName: absent.packageName, label: 'Renamed', isGame: false }]) }).games[0]
    expect(restored).toMatchObject({ installed: true, label: 'Renamed', favorite: true })
  })
  it('adds only game candidates, rather than persisting the whole launcher list', () => {
    const result = mergeDiscovered([], [{ packageName: 'com.example.game', isGame: true }, { packageName: 'com.example.bank', isGame: false }])
    expect(result.map((game) => game.packageName)).toEqual(['com.example.game'])
  })
  it('rejects malformed and duplicate package entries', () => {
    expect(sanitizeLibrary({ games: [...saved, ...saved, null, { packageName: '../../private' }] }).games).toHaveLength(1)
  })
  it('searches packages and combines favorites with sorting', () => {
    const list = sanitizeLibrary({ games: [...saved, { packageName: 'com.other.game', label: 'Another', favorite: false }] }).games
    expect(selectGames(list, { search: 'com.example', filter: 'favorites' })).toHaveLength(1)
    expect(selectGames(list, { sort: 'name' })[0].label).toBe('Another')
  })
  it('leaves the library intact when the device reports no launchable apps', async () => {
    appsNative.getInstalledApps.mockResolvedValueOnce([])
    const before = JSON.stringify(gameLibrary.getState().data)
    await expect(discoverGames()).rejects.toThrow(/no launchable apps/i)
    expect(JSON.stringify(gameLibrary.getState().data)).toBe(before)
  })
  it('retains explicit false controls and rejects unsupported profile knobs', () => {
    const profile = sanitizeProfile({ id: 'competitive', dnd: false, overlay: false, intervalMs: 1, cpuClock: 9999 })
    expect(profile).toMatchObject({ dnd: false, overlay: false, intervalMs: 2000 })
    expect(profile).not.toHaveProperty('cpuClock')
  })
})
