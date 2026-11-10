import { AppState, PermissionsAndroid, Platform } from 'react-native'
import gamingNative from '../native/gaming'
import appsNative from '../native/apps'
import { gameLibrary, updateGame } from '../store/gameLibrary'
import { PROFILE_PRESETS, sanitizeProfile } from '../lib/gameProfiles'
import { ACCENTS } from '../lib/designTokens'

export async function requestSessionNotifications() {
  if (Platform.OS !== 'android') return false
  if (Number(Platform.Version) >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    if (!await PermissionsAndroid.check(permission) && await PermissionsAndroid.request(permission) !== PermissionsAndroid.RESULTS.GRANTED) return false
  }
  const capabilities = await gamingNative.getCapabilities()
  return capabilities.notifications === true
}

/** The HUD panel is always dark, so the accent always resolves through the
 *  dark-variant set (a light-mode mono/black accent would vanish on it).
 *  `overlayAccent: 'app'` follows the app's chosen accent the same way. */
export function hudAccentHex(preferences, theme) {
  const custom = preferences.overlayAccent
  const accentId = custom && custom !== 'app' ? custom : preferences.accent
  const set = ACCENTS[accentId]
  if (set) return set.dark.accent
  return theme.accent.color
}

export function gamingConfig(preferences, theme, reducedMotion) {
  return {
    accent: hudAccentHex(preferences, theme),
    opacity: preferences.overlayOpacity,
    overlayEnabled: preferences.overlayEnabled,
    size: preferences.overlaySize ?? 56,
    intervalMs: preferences.batteryConscious ? Math.max(5000, preferences.monitorIntervalMs) : preferences.monitorIntervalMs,
    haptics: preferences.haptics,
    batteryConscious: preferences.batteryConscious === true,
    reducedMotion,
    shortcuts: preferences.overlayShortcuts ?? ['profile', 'timer', 'network'],
    autoHide: preferences.overlayAutoHide !== false,
    // seconds before open HUD panels collapse back to the notch; 0 disables
    autoCollapseSeconds:
      preferences.overlayAutoCollapse === 'never'
        ? 0
        : Number(preferences.overlayAutoCollapse) || 10,
    // Visibility mode for the collapsed control HUD over games ('edge' handle,
    // 'notification' reopen entry, 'disabled'); the module clamps the enum.
    hudVisibility: preferences.overlayVisibility ?? 'edge',
    // Separate FPS stats HUD (second, fully pass-through window).
    fpsHudEnabled: preferences.fpsHudEnabled === true,
    fpsHudMode: preferences.fpsHudMode ?? 'minimal',
    fpsHudOpacity: preferences.fpsHudOpacity ?? 0.9,
    fpsHudCorner: preferences.fpsHudCorner ?? 'topLeft',
    fpsHudScale: preferences.fpsHudScale ?? 1,
    fpsHudMetrics: preferences.fpsHudMetrics ?? ['cpu', 'ram', 'temp', 'battery', 'refresh'],
    notifications: preferences.notifications,
    macroEnabled: preferences.macroEnabled === true,
    autoDetectGames: preferences.autoDetectGames === true,
    retentionDays: preferences.retentionDays ?? 30,
    networkTarget: preferences.networkTarget ?? 'https://www.gstatic.com/generate_204',
    games: gameLibrary.getState().data.games,
    profiles: PROFILE_PRESETS.map(sanitizeProfile),
    reminderMinutes: preferences.reminderMinutes ?? 0,
  }
}

export async function launchGame(game, config) {
  if (AppState.currentState !== 'active') return { ok: false, message: 'Open Optinix to launch a gaming session.' }
  if (!game?.installed) return { ok: false, message: 'This game is not currently installed or visible. Refresh the library.' }
  const savedProfile = sanitizeProfile(game.profile)
  const profile = { ...savedProfile, overlay: savedProfile.overlay && config.overlayEnabled !== false }
  if (config.hudVisibility !== 'disabled' && (config.notifications || config.hudVisibility === 'notification')) await requestSessionNotifications()
  await gamingNative.configure(config)
  const session = config.hudVisibility === 'disabled'
    ? { ok: false, message: 'Gaming service is disabled: no HUD, timer or session tools are running.' }
    : await gamingNative.startSession({ ...config, gamePackage: game.packageName, gameLabel: game.label, profile, showOverlay: profile.overlay })
  const opened = await appsNative.openApp(game.packageName)
  if (!opened) {
    if (session.ok) await gamingNative.endSession()
    return { ok: false, message: 'Android could not open this game. It may have been removed or disabled.' }
  }
  await updateGame(game.packageName, { lastLaunchedAt: Date.now() })
  return { ok: true, message: `${game.label} launched. ${session.message ?? 'Session controls are available in Gaming tools.'}`, settings: session.settings ?? [] }
}
