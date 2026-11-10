jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Test Device',
  brand: 'TestBrand',
  manufacturer: 'TestMaker',
  osVersion: '16',
  deviceName: 'test-device',
  totalMemory: 12 * 1024 * 1024 * 1024,
}))

jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn(() => Promise.resolve(0.8)),
  getBatteryStateAsync: jest.fn(() => Promise.resolve(1)),
  isLowPowerModeEnabledAsync: jest.fn(() => Promise.resolve(false)),
  getBatteryState: jest.fn(() => Promise.resolve(1)),
  addBatteryLevelListener: jest.fn(() => ({ remove: jest.fn() })),
  addBatteryStateListener: jest.fn(() => ({ remove: jest.fn() })),
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
}))

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'WIFI' }),
  ),
  getIpAddressAsync: jest.fn(() => Promise.resolve('192.168.1.10')),
  NetworkStateType: { NONE: 'NONE', WIFI: 'WIFI', CELLULAR: 'CELLULAR' },
}))

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
  executionEnvironment: 'bare',
}))

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
}))

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// Reanimated 4 needs a real native module at import time (worklets runtime);
// tests run host-only, so mock the API surface used in src.
jest.mock('react-native-reanimated', () => {
  const { View, Text, ScrollView } = require('react-native')

  const makeTransition = () => {
    const transition = () => ({})
    transition.duration = () => makeTransition()
    transition.delay = () => makeTransition()
    transition.springify = () => makeTransition()
    transition.damping = () => makeTransition()
    transition.stiffness = () => makeTransition()
    transition.easing = () => makeTransition()
    transition.withCallback = () => makeTransition()
    transition.build = () => ({})
    return transition
  }

  const identity = (value) => value
  const ease = (fn) => fn

  const animations = {
    FadeIn: makeTransition(),
    FadeInDown: makeTransition(),
    FadeInUp: makeTransition(),
    FadeOut: makeTransition(),
    FadeOutDown: makeTransition(),
    FadeOutUp: makeTransition(),
    SlideInDown: makeTransition(),
    SlideInUp: makeTransition(),
    SlideOutDown: makeTransition(),
    SlideOutUp: makeTransition(),
    ZoomIn: makeTransition(),
    ZoomOut: makeTransition(),
    Keyframe: makeTransition(),
  }

  const AnimatedMock = {
    ...animations,
    View,
    Text,
    ScrollView,
    createAnimatedComponent: (Component) => Component,
  }

  return {
    __esModule: true,
    default: AnimatedMock,
    ...AnimatedMock,
    Easing: {
      linear: ease,
      quad: ease,
      cubic: ease,
      back: ease,
      elastic: ease,
      in: ease,
      out: ease,
      inOut: ease,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend' },
    useSharedValue: (initial) => ({ value: initial }),
    useDerivedValue: (mapper) => mapper(),
    useAnimatedStyle: (mapper) => mapper(),
    useAnimatedProps: (mapper) => mapper(),
    useAnimatedReaction: () => {},
    useEvent: () => jest.fn(),
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withDelay: identity,
    withSequence: identity,
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
  }
})

jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: jest.fn(() => ({
      initialize: jest.fn(() => Promise.resolve([{ state: 1, description: 'Google Mobile Ads SDK initialized.' }])),
      setRequestConfiguration: jest.fn(() => Promise.resolve()),
    })),
    BannerAd: ({ onAdLoaded, ...props }) => {
      React.useEffect(() => {
        onAdLoaded?.()
      }, [onAdLoaded])
      return React.createElement(View, { testID: 'admob-banner-ad', ...props })
    },
    BannerAdSize: {
      BANNER: 'BANNER',
      FULL_BANNER: 'FULL_BANNER',
      LARGE_BANNER: 'LARGE_BANNER',
      LEADERBOARD: 'LEADERBOARD',
      MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
      ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
      ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
      INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER',
    },
    TestIds: {
      BANNER: 'ca-app-pub-3940256099942544/6300978111',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
      REWARDED_INTERSTITIAL: 'ca-app-pub-3940256099942544/5354046379',
      APP_OPEN: 'ca-app-pub-3940256099942544/9257395921',
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => {
        const listeners = {}
        return {
          load: jest.fn(() => {
            listeners['loaded']?.()
          }),
          show: jest.fn(() => {
            listeners['earned_reward']?.({ type: 'coins', amount: 10 })
            return Promise.resolve()
          }),
          addAdEventListener: jest.fn((event, callback) => {
            listeners[event] = callback
            return () => { delete listeners[event] }
          }),
        }
      }),
    },
    AdEventType: {
      LOADED: 'loaded',
      ERROR: 'error',
      OPENED: 'opened',
      CLOSED: 'closed',
      CLICKED: 'clicked',
    },
    RewardedAdEventType: {
      LOADED: 'loaded',
      EARNED_REWARD: 'earned_reward',
    },
    AdsConsent: {
      requestInfoUpdate: jest.fn(() => Promise.resolve({ isConsentFormAvailable: false, status: 'NOT_REQUIRED' })),
      loadAndShowConsentFormIfRequired: jest.fn(() => Promise.resolve({ status: 'OBTAINED' })),
      showConsentForm: jest.fn(() => Promise.resolve({ status: 'OBTAINED' })),
      getStatus: jest.fn(() => Promise.resolve('NOT_REQUIRED')),
      reset: jest.fn(() => Promise.resolve()),
    },
    AdsConsentStatus: {
      UNKNOWN: 'UNKNOWN',
      NOT_REQUIRED: 'NOT_REQUIRED',
      REQUIRED: 'REQUIRED',
      OBTAINED: 'OBTAINED',
    },
  }
})
