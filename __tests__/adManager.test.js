import adManager, { DEFAULT_AD_CONFIG } from '../src/services/adManager'

describe('adManager', () => {
  beforeEach(() => {
    // Reset internal state
    adManager.setOptimizing(false)
    adManager.setGamingActive(false)
  })

  test('provides valid Google test ad unit IDs by default', () => {
    expect(adManager.bannerAdUnitId).toBe(DEFAULT_AD_CONFIG.bannerAdUnitId)
    expect(adManager.rewardedAdUnitId).toBe(DEFAULT_AD_CONFIG.rewardedAdUnitId)
    expect(adManager.bannerAdUnitId).toContain('ca-app-pub-3940256099942544')
    expect(adManager.rewardedAdUnitId).toContain('ca-app-pub-3940256099942544')
  })

  test('canShowAds returns true when idle', () => {
    expect(adManager.canShowAds()).toBe(true)
    const state = adManager.getState()
    expect(state.canShowAds).toBe(true)
    expect(state.isOptimizing).toBe(false)
    expect(state.isGamingActive).toBe(false)
  })

  test('suppresses ads when optimization is running (Rule 6)', () => {
    const listener = jest.fn()
    const unsubscribe = adManager.subscribe(listener)

    adManager.setOptimizing(true)
    expect(adManager.canShowAds()).toBe(false)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ isOptimizing: true, canShowAds: false })
    )

    adManager.setOptimizing(false)
    expect(adManager.canShowAds()).toBe(true)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ isOptimizing: false, canShowAds: true })
    )

    unsubscribe()
  })

  test('suppresses ads when gaming session is active (Rule 7)', () => {
    adManager.setGamingActive(true)
    expect(adManager.canShowAds()).toBe(false)
    expect(adManager.getState().isGamingActive).toBe(true)

    adManager.setGamingActive(false)
    expect(adManager.canShowAds()).toBe(true)
  })

  test('rejects rewarded ads when optimization or gaming is running', async () => {
    adManager.setOptimizing(true)
    const optResult = await adManager.showRewardedAd()
    expect(optResult.ok).toBe(false)
    expect(optResult.reason).toBe('optimizing')

    adManager.setOptimizing(false)
    adManager.setGamingActive(true)
    const gamingResult = await adManager.showRewardedAd()
    expect(gamingResult.ok).toBe(false)
    expect(gamingResult.reason).toBe('gaming_active')
  })

  test('initializes successfully without throwing', async () => {
    const result = await adManager.initialize()
    expect(result.ok).toBe(true)
    expect(result.initialized).toBe(true)
    expect(adManager.getState().isInitialized).toBe(true)
  })
})
