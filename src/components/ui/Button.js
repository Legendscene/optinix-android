import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { usePreferences, useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  icon = null,
  accessibilityLabel,
}) {
  const theme = useTheme()
  const { preferences } = usePreferences()
  const primary = variant === 'primary'
  const ghost = variant === 'ghost'
  const height = size === 'lg' ? 56 : 48
  const radius = theme.radius.md

  const scale = useSharedValue(1)
  const pressOpacity = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.45 : pressOpacity.value,
  }), [disabled])

  const handlePress = (event) => {
    if (disabled || loading) return
    if (preferences.haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    onPress?.(event)
  }

  const handlePressIn = () => {
    if (disabled || loading) return
    /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design */
    pressOpacity.value = withTiming(0.86, { duration: 110, easing: Easing.out(Easing.quad) })
    if (!preferences.reducedMotion) {
      scale.value = withTiming(0.97, { duration: 110, easing: Easing.out(Easing.quad) })
    }
    /* eslint-enable react-hooks/immutability */
  }

  const handlePressOut = () => {
    if (disabled || loading) return
    /* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design */
    pressOpacity.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) })
    if (!preferences.reducedMotion) {
      scale.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) })
    }
    /* eslint-enable react-hooks/immutability */
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[styles.base,
        {
          minHeight: height,
          paddingVertical: size === 'sm' ? 8 : 12,
          borderRadius: radius,
          borderWidth: ghost ? 1 : 0,
          borderColor: theme.colors.border.light,
          backgroundColor: primary ? 'transparent' : ghost ? 'transparent' : theme.colors.bg[3],
        },
        animatedStyle,
        style,
      ]}
    >
      {primary ? (
        <LinearGradient
          colors={[theme.accent.color, theme.accent.hover]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={primary ? theme.accent.onAccent : theme.accent.color} />
        ) : (
          <>
            {icon}
            <Type
              variant="bodySemi"
              style={{ fontSize: 15 }}
              tone={primary ? 'onAccent' : 'primary'}
            >
              {label}
            </Type>
          </>
        )}
      </View>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})

export default Button
