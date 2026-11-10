import React, { useEffect, useRef, useState } from 'react'
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated'

import { usePreferences } from '../../theme/ThemeProvider'
import { Type } from './Type'

// Presentational count-up for a real, measured number. It never invents data:
// a null value keeps rendering an honest '--' and plays no animation, and the
// count-up runs exactly once when the first real number arrives — later live
// updates render instantly so the figure never drifts theatrically.
export function CountUp({ value, variant = 'monoXl', tone = 'primary', style }) {
  const { reducedMotion } = usePreferences()
  const [shown, setShown] = useState(value == null ? '--' : String(Math.round(value)))
  const hasPlayed = useRef(false)
  const from = useSharedValue(0)
  const to = useSharedValue(0)
  const progress = useSharedValue(1)

  useAnimatedReaction(
    () => Math.round(from.value + (to.value - from.value) * progress.value),
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setShown)(String(current))
      }
    },
  )

  useEffect(() => {
    if (value == null) {
      hasPlayed.current = false
      return
    }
    const target = Math.round(value)
    if (reducedMotion || hasPlayed.current) {
      from.value = target
      to.value = target
      progress.value = 1
      return
    }
    hasPlayed.current = true
    from.value = 0
    to.value = target
    progress.value = 0
    progress.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) })
  }, [value, reducedMotion, from, to, progress])

  return (
    <Type variant={variant} tone={tone} style={style}>
      {value == null ? '--' : shown}
    </Type>
  )
}

export default CountUp
