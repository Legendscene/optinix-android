/**
 * PulseDot — a small breathing status dot.
 *
 * Loop animations were reviewed separately from entrance animations: the
 * 2026-11-07 device freeze came from Reanimated `entering` on many mounted
 * cards, not from transform/opacity loops (the tab pill, CountUp and button
 * press motion all run fine on RMX3998). This component repeats opacity on
 * a shared value — no layout involvement — goes fully static when the user
 * prefers reduced motion, and renders nothing when inactive.
 */
import React, { useEffect } from 'react'
import Reanimated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withDelay } from 'react-native-reanimated'

import { useTheme, usePreferences } from '../../theme/ThemeProvider'

const TONE_COLORS = {
  accent: (theme) => theme.accent.color,
  success: (theme) => theme.colors.semantic.green,
  warn: (theme) => theme.colors.semantic.yellow,
  danger: (theme) => theme.colors.semantic.red,
}

export function PulseDot({ active = true, size = 8, tone = 'accent' }) {
  const theme = useTheme()
  const { reducedMotion } = usePreferences()
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (!active || reducedMotion) {
      pulse.value = 1
      return undefined
    }
    pulse.value = withDelay(300, withRepeat(withTiming(0.35, { duration: 900 }), -1, true))
    return () => {
      pulse.value = 1
    }
  }, [active, reducedMotion, pulse])

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }))
  if (!active) return null
  const color = (TONE_COLORS[tone] ?? TONE_COLORS.accent)(theme)

  return (
    <Reanimated.View
      accessible={false}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

export default PulseDot
