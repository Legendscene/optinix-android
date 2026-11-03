import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import { usePreferences, useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

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

  const handlePress = (event) => {
    if (disabled || loading) return
    if (preferences.haptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
    onPress?.(event)
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          paddingVertical: size === 'sm' ? 8 : 12,
          borderRadius: radius,
          opacity: disabled ? 0.45 : pressed ? 0.86 : 1,
          borderWidth: ghost ? 1 : 0,
          borderColor: theme.colors.border.light,
          backgroundColor: primary ? 'transparent' : ghost ? 'transparent' : theme.colors.bg[3],
        },
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
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})

export default Button
