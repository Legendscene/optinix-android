import { createPersistentStore } from './persistentStore'
import { sanitizeProfile } from '../lib/gameProfiles'
import appsNative from '../native/apps'

export function sanitizeLibrary(raw) {
  const seen = new Set()
  const games = (Array.isArray(raw?.games) ? raw.games : []).filter((game) => {
    if (!game || typeof game.packageName !== 'string' || !/^[a-zA-Z][\w]*(\.[\w]+)+$/.test(game.packageName) || seen.has(game.packageName)) return false
    seen.add(game.packageName)
    return true
  }).slice(0, 500).map((game) => ({
    packageName: game.packageName,
    label: String(game.label || game.packageName).slice(0, 120),
    installed: game.installed !== false,
    favorite: game.favorite === true,
    manual: game.manual === true,
    detection: game.detection === 'category' ? 'category' : game.manual ? 'manual' : 'heuristic',
    lastLaunchedAt: Number.isFinite(game.lastLaunchedAt) ? Math.max(0, game.lastLaunchedAt) : 0,
    profile: sanitizeProfile(game.profile),
  }))
  return { games, discoveryEnabled: raw?.discoveryEnabled === true, excluded: [...new Set((Array.isArray(raw?.excluded) ? raw.excluded : []).filter((value) => typeof value === 'string' && /^[a-zA-Z][\w]*(\.[\w]+)+$/.test(value)))].slice(0, 500) }
}

export function mergeDiscovered(current, discovered) {
  const byPackage = new Map(discovered.map((game) => [game.packageName, game]))
  const merged = current.map((game) => ({ ...game, ...(byPackage.has(game.packageName) ? { label: byPackage.get(game.packageName).label, installed: true } : { installed: false }) }))
  discovered.filter((game) => game.isGame && !current.some((saved) => saved.packageName === game.packageName)).forEach((game) => merged.push({ ...game, installed: true }))
  return merged
}

export function selectGames(games, { search = '', filter = 'all', sort = 'recent' } = {}) {
  const query = search.trim().toLowerCase()
  return games.filter((game) =>
    (!query || `${game.label} ${game.packageName}`.toLowerCase().includes(query)) &&
    (filter !== 'favorites' || game.favorite) && (filter !== 'installed' || game.installed)
  ).sort((a, b) => sort === 'name' ? a.label.localeCompare(b.label) : b.lastLaunchedAt - a.lastLaunchedAt || Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label))
}

export const gameLibrary = createPersistentStore('optinix:games:v1', { games: [] }, sanitizeLibrary)
export const useGameLibrary = gameLibrary.useStore

export async function discoverGames() {
  if (!appsNative.isAvailable) throw new Error('Game discovery needs the Optinix Android build.')
  const launchable = await appsNative.getInstalledApps(true)
  await gameLibrary.change((data) => ({ ...data, discoveryEnabled: true, games: mergeDiscovered(data.games, launchable.filter((app) => !data.excluded.includes(app.packageName))) }))
  return launchable
}

export const addGame = (game) => gameLibrary.change((data) => ({ ...data, excluded: data.excluded.filter((id) => id !== game.packageName), games: data.games.some((item) => item.packageName === game.packageName) ? data.games : [...data.games, { ...game, manual: true, installed: true }] }))
export const updateGame = (packageName, patch) => gameLibrary.change((data) => ({ ...data, games: data.games.map((game) => game.packageName === packageName ? { ...game, ...patch } : game) }))
export const removeGame = (packageName) => gameLibrary.change((data) => ({ ...data, excluded: [...data.excluded, packageName], games: data.games.filter((game) => game.packageName !== packageName) }))
