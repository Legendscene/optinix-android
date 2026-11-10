/**
 * OnboardingScreen.js — one-time first-run setup that follows the honesty rules:
 * every permission is explained with what it actually powers, status is read live
 * from Android (never assumed), and "Continue" stays available even when something
 * is missing (Settings covers the rest). Completion is persisted as the
 * `onboardingDone` preference, so this screen normally runs exactly once.
 *
 * Steps: Welcome → Motion choice → What it does → Permissions → Ready. The
 * user picks the animation level up front (Full / Reduced); the choice is the
 * syncable `motion` preference and can be changed later in Settings. Motion is
 * dropped when the user prefers reduced motion.
 *
 * Animated onboarding (2026-11-09): every step is remounted when `step`
 * changes (the keyed Reanimated.View wrapper below), so the staggered
 * FadeInDown entrances are strictly one-shot — the 2026-11-07 entrance-freeze
 * gotcha cannot apply. All of it is gated on reduced motion: the Stagger
 * helper then renders plain Views, and the rail snaps instead of animating.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  BackHandler,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import Reanimated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import appsNative from '../native/apps'
import gamingNative from '../native/gaming'
import { requestSessionNotifications } from '../services/gaming'
import { tap as hapticTap } from '../lib/haptics'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CountUp } from '../components/ui/CountUp'
import { Type } from '../components/ui/Type'

const TOTAL_STEPS = 5

/** The animation-level choice offered as its own onboarding step. */
const MOTION_CHOICES = [
  {
    id: 'full',
    title: 'Full effects',
    detail: 'Springs, fades and every micro-animation Optinix has. The lively default.',
  },
  {
    id: 'reduced',
    title: 'Reduced motion',
    detail: 'No extra animation anywhere — every feature still works exactly the same.',
  },
]

const WHAT_IT_DOES = [
  {
    title: 'Measured, never invented',
    detail: 'CPU, RAM, temperature and battery are read from your device. If Android cannot report something, you see "--" instead of a number we made up.',
  },
  {
    title: 'A HUD that plays fair',
    detail: 'A slim edge handle opens session tools over your game on Android 10–16. Notification-only and completely disabled modes are available. Game FPS is not exposed to ordinary apps.',
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
    detail: 'Shows the edge handle, the three-tab game assistant panel and the stats HUD. Android 10 Go may block this permission; in-app tools remain usable.',
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

/**
 * Stagger — one-shot list entrance for static step content. `index` spaces each
 * item 85 ms apart; reduced motion renders an ordinary View. Used only inside
 * the per-step remount wrapper, so an entrance never replays on data changes.
 */
function Stagger({ index, reducedMotion, children, style }) {
  if (reducedMotion) return <View style={style}>{children}</View>
  return (
    <Reanimated.View style={style} entering={FadeInDown.duration(300).delay(index * 85)}>
      {children}
    </Reanimated.View>
  )
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
  // Animation level picked in this run (transient until the user continues).
  const [motionChoice, setMotionChoice] = useState(preferences.motion === 'reduced' ? 'reduced' : 'full')

  // Every forward step gets a light haptic tick — tiny, but it makes the
  // flow feel alive. Hardware back walks the flow backwards instead of
  // leaving the app.
  const goTo = useCallback((next) => {
    hapticTap()
    setStep(next)
  }, [])
  const advance = useCallback(() => setStep((current) => current + 1), [])
  // Hardware back walks the flow backwards.
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
      const notificationsGranted = nativeState?.notifications === true
      setGranted({
        notifications: notificationsGranted,
        usageAccess: Boolean(nativeState?.usageAccess),
        overlay: Boolean(nativeState?.overlay),
        overlayReason: nativeState?.overlayReason,
        overlayRestricted: nativeState?.overlayRestricted,
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
          else await gamingNative.openSettings('notifications')
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
    hapticTap()
    // Move first, then persist, so the active screen is never a route that the
    // navigator just stopped declaring.
    navigation.replace('Main')
    await update({ onboardingDone: true })
  }, [navigation, update])

  const reducedMotion = preferences.motion === 'reduced'
  const motion = animate(reducedMotion, FadeInDown.duration(220), FadeOutDown.duration(160))
  const grantedCount = PERMISSIONS.filter(({ key }) => granted[key]).length

  // Every screen-level setStep call in the steps goes through goTo so each
  // forward step also gets its haptic tick.
  const shell = { step, setStep: goTo, goTo, advance, setStepRaw: setStep, theme, insets, motion, reducedMotion, update, motionChoice, setMotionChoice }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg[0] }]}>
      <Reanimated.View key={step} style={StyleSheet.absoluteFill} {...motion}>
        {step === 0 ? <WelcomeStep {...shell} /> : null}
        {step === 1 ? <MotionStep {...shell} /> : null}
        {step === 2 ? <IntroStep {...shell} /> : null}
        {step === 3 ? <PermissionsStep {...shell} granted={granted} checking={checking} busyKey={busyKey} askPermission={askPermission} /> : null}
        {step === 4 ? <DoneStep {...shell} granted={granted} grantedCount={grantedCount} finish={finish} /> : null}
      </Reanimated.View>
      <View style={[styles.rail, { bottom: insets.bottom + 18 }]}>
        <Rail step={step} reducedMotion={reducedMotion} />
      </View>
    </View>
  )
}

/**
 * Rail — five tiny progress segments. The active one stretches with a short
 * width transition (reduced motion snaps instead); the tint stays instant.
 */
function Rail({ step, reducedMotion }) {
  const theme = useTheme()
  return (
    <View style={styles.railRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <RailDot key={index} index={index} step={step} theme={theme} reducedMotion={reducedMotion} />
      ))}
    </View>
  )
}

function RailDot({ index, step, theme, reducedMotion }) {
  const active = step === index
  const done = index < step
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(active ? 26 : 12, { duration: reducedMotion ? 0 : 220 }),
  }), [active, reducedMotion])
  return (
    <Reanimated.View
      style={[
        animatedStyle,
        {
          height: 4,
          borderRadius: 2,
          opacity: done || active ? 1 : 0.45,
          backgroundColor: done || active ? theme.accent.color : theme.colors.border.base,
        },
      ]}
    />
  )
}

function WelcomeStep({ step, setStep, theme, insets, reducedMotion }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <View style={styles.heroGap}>
        <Stagger index={0} reducedMotion={reducedMotion} style={{ alignItems: 'center' }}>
          <AuraMark reducedMotion={reducedMotion} />
          <Type variant="hero" tone="primary" align="center" style={{ marginTop: 22 }}>
            OPTINIX
          </Type>
        </Stagger>
        <Stagger index={1} reducedMotion={reducedMotion} style={{ alignItems: 'center' }}>
          <Type variant="body" tone="secondary" align="center" style={[styles.heroCopy, { marginTop: 10 }]}>
            Your device, measured honestly while you play. One short setup, then Optinix stays out of your way.
          </Type>
        </Stagger>
      </View>
      <Stagger index={2} reducedMotion={reducedMotion}>
        <View style={styles.footer}>
          <Button label="Get started" size="lg" onPress={() => setStep(step + 1)} />
          <Type variant="caption" tone="tertiary" align="center" style={{ marginTop: 12 }}>
            Read-only measurements. Nothing is uploaded.
          </Type>
        </View>
      </Stagger>
    </View>
  )
}

/**
 * MotionStep — the animation-level choice as its own step. Each option shows
 * a tiny real preview: the animated one plays the actual entrance animation
 * Optinix uses, the reduced one renders the same bars statically. The choice
 * is the syncable `motion` preference; Settings can change it any time.
 */
function MotionStep({ step, goTo, theme, insets, update, reducedMotion, motionChoice, setMotionChoice }) {
  const commit = async () => {
    // Fire and forget — the store persists in milliseconds and the next
    // step must not wait on it.
    update({ motion: motionChoice }).catch(() => {})
    goTo(step + 1)
  }
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <Type variant="h1" tone="primary">
        How alive should it feel?
      </Type>
      <Type variant="bodySm" tone="secondary" style={{ marginTop: 8, marginBottom: 14 }}>
        Pick your animation level. You can change this any time in Settings → Appearance.
      </Type>
      <View style={{ gap: 10 }}>
        {MOTION_CHOICES.map((choice, index) => (
          <Stagger key={choice.id} index={index * 2 + 1} reducedMotion={reducedMotion}>
            <MotionChoiceCard
              choice={choice}
              selected={motionChoice === choice.id}
              accent={theme.accent.color}
              previewDelay={index * 90}
              onPick={() => { hapticTap(); setMotionChoice(choice.id) }}
            />
          </Stagger>
        ))}
      </View>
      <Stagger index={5} reducedMotion={reducedMotion}>
        <View style={styles.footer}>
          <Button label="Continue" size="lg" onPress={commit} />
          <Type variant="caption" tone="tertiary" align="center" style={{ marginTop: 10 }}>
            Reduced motion keeps every feature — it only calms the visuals.
          </Type>
        </View>
      </Stagger>
    </View>
  )
}

function MotionChoiceCard({ choice, selected, accent, previewDelay, onPick }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={choice.title}
      onPress={onPick}
      style={({ pressed }) => [
        styles.motionRow,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Card padded={false} accent={selected} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <MotionPreview reduced={choice.id === 'reduced'} accent={accent} delay={previewDelay} />
          <View style={{ flex: 1, gap: 3 }}>
            <Type variant="bodySemi" tone={selected ? 'primary' : 'secondary'}>{choice.title}</Type>
            <Type variant="caption" tone="tertiary">{choice.detail}</Type>
          </View>
          <Type variant="bodySemi" tone={selected ? 'accent' : 'tertiary'}>
            {selected ? '◉' : '○'}
          </Type>
        </View>
      </Card>
    </Pressable>
  )
}

/** Three accent bars: staggered entrance when animated, static when not. */
function MotionPreview({ reduced, accent, delay }) {
  const bars = [0, 1, 2]
  if (reduced) {
    return (
      <View style={styles.previewRow}>
        {bars.map((bar) => (
          <View key={bar} style={[styles.previewBar, { backgroundColor: accent, opacity: 0.45 }]} />
        ))}
      </View>
    )
  }
  return (
    <View style={styles.previewRow}>
      {bars.map((bar) => (
        <Reanimated.View
          key={bar}
          entering={FadeInDown.duration(300).delay(delay + bar * 110)}
          style={[styles.previewBar, { backgroundColor: accent }]}
        />
      ))}
    </View>
  )
}

function IntroStep({ step, setStep, theme, insets, reducedMotion }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <Type variant="h1" tone="primary">
        What Optinix does
      </Type>
      <View style={{ gap: 10, marginTop: 18 }}>
        {WHAT_IT_DOES.map((item, index) => (
          <Stagger key={item.title} index={index} reducedMotion={reducedMotion} style={{ marginTop: 8 }}>
            <Type variant="body" tone="primary">
              {'\u2022'}{'  '}
              <Type variant="bodySemi">{item.title}.</Type>
              {'  '}
              <Type variant="bodySm" tone="secondary">
                {item.detail}
              </Type>
            </Type>
          </Stagger>
        ))}
      </View>
      <Stagger index={WHAT_IT_DOES.length} reducedMotion={reducedMotion}>
        <View style={styles.footer}>
          <Button label="Continue" size="lg" onPress={() => setStep(step + 1)} />
        </View>
      </Stagger>
    </View>
  )
}

function PermissionsStep({ step, setStep, theme, insets, reducedMotion, granted, checking, busyKey, askPermission }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <Type variant="h1" tone="primary">
        A few Android permissions
      </Type>
      <Type variant="bodySm" tone="secondary" style={{ marginTop: 8, marginBottom: 14 }}>
        Each one powers something visible. You can grant now or later in Settings — the rest of the app works either way and Optinix never asks twice on its own.
      </Type>
      <View style={{ gap: 10 }}>
        {PERMISSIONS.map((permission, index) => {
          const label = checking || busyKey === permission.key
              ? 'Checking\u2026'
              : granted[permission.key] ? 'Ready' : permission.key === 'overlay' && granted.overlayRestricted ? 'Restricted' : 'Not yet'
          const isGranted = Boolean(granted[permission.key])
          return (
            <Stagger key={permission.key} index={index} reducedMotion={reducedMotion}>
              <Card padded={false} style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={styles.permissionRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Type variant="bodySemi">{permission.title}</Type>
                      <Type variant="mono" tone={isGranted ? 'success' : 'tertiary'}>
                        {label}
                      </Type>
                    </View>
                    <Type variant="caption" tone="secondary">
                      {permission.key === 'overlay' && granted.overlayReason ? granted.overlayReason : permission.detail}
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
            </Stagger>
          )
        })}
      </View>
      <Stagger index={PERMISSIONS.length} reducedMotion={reducedMotion}>
        <View style={styles.footer}>
          <Button label="Continue" size="lg" onPress={() => setStep(step + 1)} />
        </View>
      </Stagger>
    </View>
  )
}

function buttonLabelFor(key) {
  if (key === 'notifications') return 'Allow'
  if (key === 'battery') return 'Allow'
  return 'Open Settings'
}

function DoneStep({ step, theme, insets, reducedMotion, grantedCount, finish }) {
  return (
    <View style={[styles.step, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 72 }]}>
      <View style={styles.heroGap}>
        <Stagger index={0} reducedMotion={reducedMotion} style={{ alignItems: 'center' }}>
          <CountUp value={grantedCount} variant="display2" tone="accent" />
          <Type variant="h1" align="center" style={{ marginTop: 6 }}>
            Setup complete
          </Type>
        </Stagger>
        <Stagger index={1} reducedMotion={reducedMotion} style={{ alignItems: 'center' }}>
          <Type variant="body" tone="secondary" align="center" style={[styles.heroCopy, { marginTop: 10 }]}>
            Optinix is ready. Start a session from the Games tab, or leave the HUD handy for your next match. Missing permissions can always be granted later in Settings — no nagging.
          </Type>
        </Stagger>
      </View>
      <Stagger index={2} reducedMotion={reducedMotion}>
        <View style={styles.footer}>
          <Button label="Enter Optinix" size="lg" onPress={finish} />
        </View>
      </Stagger>
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
  motionRow: { borderRadius: 12 },
  previewRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  previewBar: { width: 18, height: 4, borderRadius: 2 },
})
