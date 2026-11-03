/**
 * OnboardingScreen.js — one-time first-run setup that follows the honesty rules:
 * every permission is explained with what it actually powers, status is read live
 * from Android (never assumed), and "Continue" stays available even when something
 * is missing (Settings covers the rest). Completion is persisted as the
 * `onboardingDone` preference, so this screen normally runs exactly once.
 *
 * Steps: Welcome → What it does → Permissions → Ready. Motion is dropped when the
 * user prefers reduced motion.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  BackHandler,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
} from 'react-native'
import Reanimated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import appsNative from '../native/apps'
import { requestSessionNotifications } from '../services/gaming'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Type } from '../components/ui/Type'

const TOTAL_STEPS = 4

const WHAT_IT_DOES = [
  {
    title: 'Measured, never invented',
    detail: 'CPU, RAM, temperature and battery are read from your device. If Android cannot report something, you see "--" instead of a number we made up.',
  },
  {
    title: 'A HUD that plays fair',
    detail: 'A small draggable bubble with a session timer and shortcuts floats over your game. Frame-rate numbers for games are not measurable without root, so the HUD never claims them.',
  },
  {
    title: 'Only safe cleanups',
    detail: 'Memory sweep and Optinix\u2019s own cache cleanup. Clearing other apps\u2019 caches or killing system apps needs root, so Optinix refuses instead of pretending.',
  },
]

const PERMISSIONS = [
  {
    key: 'notifications',
    title: 'Notifications',
    detail: 'Break reminders and gaming session controls live in the notification area.',
  },
  {
    key: 'usageAccess',
    title: 'Usage access',
    detail: 'Tells Optinix which game is in the foreground, so the HUD and session tools appear at the right moment.',
  },
  {
    key: 'overlay',
    title: 'Draw over other apps',
    detail: 'Shows the floating HUD bubble, quick menu and dashboard during gaming sessions.',
  },
  {
    key: 'battery',
    title: 'Unrestricted battery',
    detail: 'Lets timers and the HUD keep running while a long gaming session continues in the background.',
  },
]

function animate(reducedMotion, entering, exiting) {
  return { entering: reducedMotion ? undefined : entering, exiting: reducedMotion ? undefined : exiting }
}

export default function OnboardingScreen({ navigation }) {
  const theme = useTheme()
  const { preferences, update } = usePreferences()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(0)
  const [granted, setGranted] = useState({})
  const [checking, setChecking] = useState(true)
  const [busyKey, setBusyKey] = useState(null)
  const closing = useRef(false)

  // Hardware back walks the flow backwards instead of leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        setStep((current) => current - 1)
        return true
      }
      return false
    })
    return () => subscription.remove()
  }, [step])

  const refresh = useCallback(async () => {
    setChecking(true)
    try {
      const nativeState = await appsNative.getPermissionState()
      const notificationsGranted =
        Platform.OS !== 'android' || Number(Platform.Version) < 33
          ? true
          : Boolean(await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS))
      setGranted({
        notifications: notificationsGranted,
        usageAccess: Boolean(nativeState?.usageAccess),
        overlay: Boolean(nativeState?.overlay),
        battery: Boolean(nativeState?.batteryOptimizationExempt),
      })
    } catch {
      setGranted({})
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) refresh()
    })
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !cancelled) refresh()
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [refresh])

  const askPermission = useCallback(
    async (key) => {
      setBusyKey(key)
      try {
        if (key === 'notifications') {
          const ok = await requestSessionNotifications()
          if (ok) await update({ notifications: true })
          refresh()
        } else if (key === 'usageAccess') {
          await appsNative.openUsageAccessSettings()
        } else if (key === 'overlay') {
          await appsNative.openOverlaySettings()
        } else if (key === 'battery') {
          await appsNative.requestBatteryOptimizationExemption()
        }
      } finally {
        setBusyKey(null)
      }
    },
    [update, refresh],
  )

  const finish = useCallback(async () => {
    if (closing.current) return
    closing.current = true
    // Move first, then persist, so the active screen is never a route that the
    // navigator just stopped declaring.
    navigation.replace('Main')
    await update({ onboardingDone: true })
  }, [navigation, update])

  const reducedMotion = preferences.motion === 'reduced'
  const motion = animate(reducedMotion, FadeInDown.duration(220), FadeOutDown.duration(160))
  const grantedCount = PERMISSIONS.filter(({ key }) => granted[key]).length

  const shell = { step, setStep, theme, insets, motion, reducedMotion }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg[0] }]}>
      <Reanimated.View key={step} style={StyleSheet.absoluteFill} {...motion}>
        {step === 0 ? <WelcomeStep {...shell} /> : null}
        {step === 1 ? <IntroStep {...shell} /> : null}
        {step === 2 ? <PermissionsStep {...shell} granted={granted} checking={checking} busyKey={busyKey} askPermission={askPermission} /> : null}
        {step === 3 ? <DoneStep {...shell} granted={granted} grantedCount={grantedCount} finish={finish} /> : null}
      </Reanimated.View>
      <View style={[styles.rail, { bottom: insets.bottom + 18 }]}>
        <Rail step={step} />
      </View>
    </View>
  )
}

function Rail({ step }) {
  const theme = useTheme()
  return (
    <View style={styles.railRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View
          key={index}
          style={{
            height: 4,
            width: index === step ? 26 : 12,
            borderRadius: 2,
            opacity: index > step ? 0.45 : 1,
            backgroundColor: index <= step ? theme.accent.color : theme.colors.border.base,
          }}
        />
      ))}
    </View>
  )
}

function WelcomeStep({ step, setStep, theme, insets, reducedMotion }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <View style={styles.heroGap}>
        <AuraMark reducedMotion={reducedMotion} />
        <Type variant="hero" tone="primary" align="center" style={{ marginTop: 22 }}>
          OPTINIX
        </Type>
        <Type variant="body" tone="secondary" align="center" style={[styles.heroCopy, { marginTop: 10 }]}>
          Your device, measured honestly while you play. One short setup, then Optinix stays out of your way.
        </Type>
      </View>
      <View style={styles.footer}>
        <Button label="Get started" size="lg" onPress={() => setStep(step + 1)} />
        <Type variant="caption" tone="tertiary" align="center" style={{ marginTop: 12 }}>
          Read-only measurements. Nothing is uploaded.
        </Type>
      </View>
    </View>
  )
}

function IntroStep({ step, setStep, theme, insets }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <Type variant="h1" tone="primary">
        What Optinix does
      </Type>
      <View style={{ gap: 10, marginTop: 18 }}>
        {WHAT_IT_DOES.map((item) => (
          <Type key={item.title} variant="body" tone="primary" style={{ marginTop: 8 }}>
            {'\u2022'}{'  '}
            <Type variant="bodySemi">{item.title}.</Type>
            {'  '}
            <Type variant="bodySm" tone="secondary">
              {item.detail}
            </Type>
          </Type>
        ))}
      </View>
      <View style={styles.footer}>
        <Button label="Continue" size="lg" onPress={() => setStep(step + 1)} />
      </View>
    </View>
  )
}

function PermissionsStep({ step, setStep, theme, insets, granted, checking, busyKey, askPermission }) {
  const systemNotifications = Platform.OS !== 'android' || Number(Platform.Version) < 33
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <Type variant="h1" tone="primary">
        A few Android permissions
      </Type>
      <Type variant="bodySm" tone="secondary" style={{ marginTop: 8, marginBottom: 14 }}>
        Each one powers something visible. You can grant now or later in Settings — the rest of the app works either way and Optinix never asks twice on its own.
      </Type>
      <View style={{ gap: 10 }}>
        {PERMISSIONS.map((permission) => {
          const label = systemNotifications && permission.key === 'notifications'
            ? 'Ready'
            : checking || busyKey === permission.key
              ? 'Checking\u2026'
              : granted[permission.key] ? 'Ready' : 'Not yet'
          const isGranted = systemNotifications && permission.key === 'notifications' ? true : Boolean(granted[permission.key])
          return (
            <Card key={permission.key} padded={false} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={styles.permissionRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Type variant="bodySemi">{permission.title}</Type>
                    <Type variant="mono" tone={isGranted ? 'success' : 'tertiary'}>
                      {label}
                    </Type>
                  </View>
                  <Type variant="caption" tone="secondary">
                    {permission.detail}
                  </Type>
                </View>
                {!isGranted ? (
                  <Button
                    label={buttonLabelFor(permission.key)}
                    size="sm"
                    variant="ghost"
                    loading={busyKey === permission.key}
                    onPress={() => askPermission(permission.key)}
                    style={{ marginLeft: 10 }}
                  />
                ) : null}
              </View>
            </Card>
          )
        })}
      </View>
      <View style={styles.footer}>
        <Button label="Continue" size="lg" onPress={() => setStep(step + 1)} />
      </View>
    </View>
  )
}

function buttonLabelFor(key) {
  if (key === 'notifications') return 'Allow'
  if (key === 'battery') return 'Allow'
  return 'Open Settings'
}

function DoneStep({ step, theme, insets, grantedCount, finish }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <View style={styles.heroGap}>
        <Type variant="display2" tone="accent" align="center">
          {`${grantedCount}/4`}
        </Type>
        <Type variant="h1" align="center" style={{ marginTop: 6 }}>
          Setup complete
        </Type>
        <Type variant="body" tone="secondary" align="center" style={[styles.heroCopy, { marginTop: 10 }]}>
          Optinix is ready. Start a session from the Games tab, or leave the HUD handy for your next match. Missing permissions can always be granted later in Settings — no nagging.
        </Type>
      </View>
      <View style={styles.footer}>
        <Button label="Enter Optinix" size="lg" onPress={finish} />
      </View>
    </View>
  )
}

/** One quiet animated element — the breathing "O" mark. */
function AuraMark({ reducedMotion }) {
  const theme = useTheme()
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 108,
          height: 108,
          borderRadius: 54,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: theme.accent.color,
          opacity: 0.9,
          shadowColor: theme.accent.color,
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Type variant="monoXl" tone="accent">
          o
        </Type>
      </View>
      {!reducedMotion ? (
        <Reanimated.View
          entering={FadeInDown.duration(400)}
          style={{
            position: 'absolute',
            width: 156,
            height: 156,
            borderRadius: 78,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.accent.color,
            opacity: 0.35,
          }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  step: { flex: 1, paddingHorizontal: 22 },
  heroGap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { maxWidth: 420, marginTop: 8 },
  footer: { gap: 0 },
  rail: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  railRow: { flexDirection: 'row', gap: 8 },
  permissionRow: { flexDirection: 'row', alignItems: 'center' },
})
