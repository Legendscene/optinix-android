import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { usePreferences, useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function MetricRing({
  value,
  size = 176,
  stroke = 10,
  caption,
  gradientColors,
  trackColor,
  formatValue,
  children,
}) {
  const theme = useTheme()
  const { reducedMotion } = usePreferences()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = useSharedValue(0)
  const target = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100
  const gradientId = `ring${React.useId().replace(/:/g, '')}`

  useEffect(() => {
    progress.value = reducedMotion
      ? target
      : withTiming(target, { duration: 750, easing: Easing.out(Easing.cubic) })
  }, [target, reducedMotion, progress])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }))

  const colors = gradientColors ?? [theme.accent.color, theme.colors.semantic.cyan, theme.colors.semantic.violet]
  const track = trackColor ?? theme.colors.bg[4]

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            {colors.map((color, index) => (
              <Stop
                key={`${color}-${index}`}
                offset={colors.length === 1 ? 0 : index / (colors.length - 1)}
                stopColor={color}
              />
            ))}
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        {children ?? (
          <>
            <Type variant="monoXl" tone={value == null ? 'tertiary' : 'primary'}>
              {formatValue ? formatValue(value) : value == null ? '--' : `${Math.round(value)}`}
            </Type>
            {caption ? (
              <Type variant="eyebrow" tone="tertiary" style={{ marginTop: 4, fontSize: 9 }}>
                {caption}
              </Type>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
})

export default MetricRing
