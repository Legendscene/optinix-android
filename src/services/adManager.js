/**
 * adManager.js — Centralized Google AdMob monetization manager for Optinix Android.
 *
 * Requirements & Honesty rules:
 * 1. Safe test ad IDs by default — no hardcoded production IDs.
 * 2. Never displays or requests ads while an optimization sweep or gaming session is running.
 * 3. Never interrupts onboarding, permission flows, or critical system operations.
 * 4. Graceful error handling — no crashes, no blank placeholder boxes when ads fail.
 * 5. Privacy & consent support via Google User Messaging Platform (UMP) / AdsConsent.
 */
import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads'

export const DEFAULT_AD_CONFIG = {
  enabled: true,
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerAdUnitId: TestIds?.BANNER ?? 'ca-app-pub-3940256099942544/6300978111',
  rewardedAdUnitId: TestIds?.REWARDED ?? 'ca-app-pub-3940256099942544/5224354917',
  testDeviceIds: ['EMULATOR'],
}

class AdManager {
  constructor() {
    this.config = { ...DEFAULT_AD_CONFIG }
    this.isInitialized = false
    this.isInitializing = false
    this.isConsentObtained = false
    this.isOptimizing = false
    this.isGamingActive = false
    this.listeners = new Set()
    this.rewardedAd = null
    this.isRewardedLoaded = false
    this.rewardedListeners = []
  }

  /** Subscribe to ad state changes (e.g. when optimization starts/stops). */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {}
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getState())
      } catch {
        // Safe dispatch: errors in listeners do not break AdManager
      }
    }
  }

  getState() {
    return {
      enabled: this.config.enabled,
      isInitialized: this.isInitialized,
      isConsentObtained: this.isConsentObtained,
      isOptimizing: this.isOptimizing,
      isGamingActive: this.isGamingActive,
      canShowAds: this.canShowAds(),
      bannerAdUnitId: this.getBannerAdUnitId(),
      rewardedAdUnitId: this.getRewardedAdUnitId(),
    }
  }

  /** Update runtime configuration (e.g. custom ad unit IDs or toggle ads). */
  configure(customConfig = {}) {
    this.config = {
      ...this.config,
      ...customConfig,
    }
    this.notify()
  }

  get bannerAdUnitId() {
    return this.getBannerAdUnitId()
  }

  get rewardedAdUnitId() {
    return this.getRewardedAdUnitId()
  }

  getBannerAdUnitId() {
    return this.config.bannerAdUnitId || TestIds.BANNER
  }

  getRewardedAdUnitId() {
    return this.config.rewardedAdUnitId || TestIds.REWARDED
  }

  /**
   * Set whether an optimization sweep is currently executing.
   * Requirement 6: Never display ads while an optimization operation is running.
   */
  setOptimizing(active) {
    const next = Boolean(active)
    if (this.isOptimizing !== next) {
      this.isOptimizing = next
      this.notify()
    }
  }

  /**
   * Set whether an active in-game overlay session is running.
   * Requirement 7: Never display intrusive ads during in-game overlay operations.
   */
  setGamingActive(active) {
    const next = Boolean(active)
    if (this.isGamingActive !== next) {
      this.isGamingActive = next
      this.notify()
    }
  }

  /** Check if any operation is running that requires suppressing all ads. */
  isSuppressed() {
    return this.isOptimizing || this.isGamingActive || !this.config.enabled
  }

  /** Check if ads can safely be displayed right now. */
  canShowAds() {
    return this.config.enabled && !this.isOptimizing && !this.isGamingActive
  }

  /**
   * Initialize Google Mobile Ads SDK and check privacy/consent.
   */
  async initialize(customConfig = {}) {
    if (customConfig && typeof customConfig === 'object') {
      this.configure(customConfig)
    }

    if (this.isInitialized || this.isInitializing) {
      return { ok: true, initialized: this.isInitialized }
    }

    this.isInitializing = true

    try {
      // 1. Request user consent info (UMP)
      await this.requestConsent().catch(() => {})

      // 2. Initialize the Google Mobile Ads SDK
      await mobileAds().initialize()
      this.isInitialized = true
      this.notify()
      return { ok: true, initialized: true }
    } catch (error) {
      this.isInitialized = false
      return { ok: false, error: error?.message || 'Failed to initialize AdMob' }
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * Request European Economic Area (EEA) / GDPR consent via Google UMP.
   */
  async requestConsent() {
    try {
      const consentInfo = await AdsConsent.requestInfoUpdate()
      if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
        const formResult = await AdsConsent.loadAndShowConsentFormIfRequired()
        this.isConsentObtained = formResult.status === AdsConsentStatus.OBTAINED
      } else {
        this.isConsentObtained = true
      }
      return { ok: true, status: consentInfo.status }
    } catch (error) {
      this.isConsentObtained = false
      return { ok: false, error: error?.message || 'Consent request failed' }
    }
  }

  /**
   * Preload a rewarded ad for optional user-driven rewards.
   */
  preloadRewardedAd() {
    if (this.isSuppressed() || this.rewardedAd) return

    try {
      const ad = RewardedAd.createForAdRequest(this.getRewardedAdUnitId(), {
        requestNonPersonalizedAdsOnly: !this.isConsentObtained,
      })

      const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        this.isRewardedLoaded = true
        this.notify()
      })

      const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
        this.cleanRewardedAd()
        this.notify()
      })

      this.rewardedListeners = [unsubscribeLoaded, unsubscribeError]
      this.rewardedAd = ad
      ad.load()
    } catch {
      this.cleanRewardedAd()
    }
  }

  cleanRewardedAd() {
    for (const unsubscribe of this.rewardedListeners) {
      try {
        unsubscribe?.()
      } catch {
        // no-op
      }
    }
    this.rewardedListeners = []
    this.rewardedAd = null
    this.isRewardedLoaded = false
  }

  /**
   * Show a rewarded ad (e.g. for optional supporter perks or voluntary rewards).
   */
  async showRewardedAd({ onEarnedReward, onClosed, onError } = {}) {
    if (this.isOptimizing) {
      const msg = 'Ads are disabled while an optimization operation is running.'
      onError?.(new Error(msg))
      return { ok: false, reason: 'optimizing' }
    }

    if (this.isGamingActive) {
      const msg = 'Ads are disabled during an active gaming session.'
      onError?.(new Error(msg))
      return { ok: false, reason: 'gaming_active' }
    }

    if (!this.rewardedAd || !this.isRewardedLoaded) {
      this.preloadRewardedAd()
      const msg = 'Rewarded ad is still loading. Please try again shortly.'
      onError?.(new Error(msg))
      return { ok: false, reason: 'not_ready' }
    }

    return new Promise((resolve) => {
      const ad = this.rewardedAd
      let rewardEarned = false

      const subEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        rewardEarned = true
        onEarnedReward?.(reward)
      })

      const subClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup()
        onClosed?.({ rewardEarned })
        this.preloadRewardedAd() // Preload next one
        resolve({ ok: true, rewardEarned })
      })

      const subError = ad.addAdEventListener(AdEventType.ERROR, (err) => {
        cleanup()
        onError?.(err)
        this.preloadRewardedAd()
        resolve({ ok: false, error: err })
      })

      const cleanup = () => {
        subEarned?.()
        subClosed?.()
        subError?.()
        this.cleanRewardedAd()
      }

      try {
        ad.show()
      } catch (err) {
        cleanup()
        onError?.(err)
        resolve({ ok: false, error: err })
      }
    })
  }
}

export const adManager = new AdManager()
export default adManager
