import { AppState, PermissionsAndroid, Platform } from 'react-native'
import gamingNative from '../src/native/gaming'
import appsNative from '../src/native/apps'
import { launchGame, requestSessionNotifications } from '../src/services/gaming'

jest.mock('../src/native/gaming', () => ({
  configure: jest.fn(async () => ({ ok: true })),
  startSession: jest.fn(async () => ({ ok: true, message: 'Session started.' })),
  endSession: jest.fn(async () => ({ ok: true })),
  getCapabilities: jest.fn(async () => ({ notifications: true })),
}))
jest.mock('../src/native/apps', () => ({ openApp: jest.fn(async () => true) }))
jest.mock('../src/store/gameLibrary', () => ({
  gameLibrary: { getState: () => ({ data: { games: [] } }) },
  updateGame: jest.fn(async () => {}),
}))

describe('Android session compatibility', () => {
  const os = Platform.OS
  let version
  const state = AppState.currentState
  const game = { packageName: 'example.game', label: 'Test game', installed: true }

  beforeEach(() => {
    jest.clearAllMocks()
    Platform.OS = 'android'
    version = jest.spyOn(Platform, 'Version', 'get').mockReturnValue(29)
    AppState.currentState = 'active'
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED)
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false)
    gamingNative.getCapabilities.mockResolvedValue({ notifications: true })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Platform.OS = os
    AppState.currentState = state
  })

  test('Android 10 uses notification settings without requesting an Android 13 permission', async () => {
    expect(await requestSessionNotifications()).toBe(true)
    expect(PermissionsAndroid.request).not.toHaveBeenCalled()
    gamingNative.getCapabilities.mockResolvedValue({ notifications: false })
    expect(await requestSessionNotifications()).toBe(false)
  })

  test('Android 13+ handles denied notification consent honestly', async () => {
    version.mockReturnValue(33)
    PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED)
    expect(await requestSessionNotifications()).toBe(false)
  })

  test('completely disabled can launch a game without starting a service or timer', async () => {
    const result = await launchGame(game, { hudVisibility: 'disabled', notifications: true })
    expect(result.ok).toBe(true)
    expect(result.message).toContain('Gaming service is disabled')
    expect(appsNative.openApp).toHaveBeenCalledWith(game.packageName)
    expect(gamingNative.startSession).not.toHaveBeenCalled()
    expect(gamingNative.getCapabilities).not.toHaveBeenCalled()
    expect(PermissionsAndroid.request).not.toHaveBeenCalled()
  })

  test('notification-only sessions still start on API 29 even when notifications are blocked', async () => {
    gamingNative.getCapabilities.mockResolvedValue({ notifications: false })
    await launchGame(game, { hudVisibility: 'notification' })
    expect(gamingNative.startSession).toHaveBeenCalledWith(expect.objectContaining({ hudVisibility: 'notification' }))
    expect(PermissionsAndroid.request).not.toHaveBeenCalled()
  })
})
