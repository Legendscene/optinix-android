import React from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { useTheme } from '../../theme/ThemeProvider'

/**
 * Cards render instantly — no Reanimated `entering` animation. The 2026-11-07
 * FadeInDown entrance froze on-device (RMX3998, Android 16): after tab
 * switching / fast scrolling during app backgrounding, mounted cards were
 * caught mid-entrance and stayed overlapping with blank gaps until a full
 * app restart. Interaction-driven motion (button press scale, tab pill,
 * CountUp) is unaffected; layout correctness wins over entrance motion.
 */
export function Card({
  children,
  style,
  accent = false,
  padded = true,
  gradient = true,
  ...rest
}) {
  const theme = useTheme()
  const pad = theme.density.cardPad
  const colors = theme.gradients.card ?? (theme.isDark
    ? ['rgba(27,30,36,0.9)', 'rgba(14,15,19,0.94)']
    : ['rgba(255,255,255,0.98)', 'rgba(244,246,250,0.98)'])

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          borderRadius: theme.radius.xl,
          borderColor: accent ? theme.accent.line : theme.colors.border.base,
          padding: padded ? pad : 0,
          backgroundColor: theme.colors.bg[1],
          borderTopColor: accent ? theme.accent.color : theme.colors.border.light,
        },
        accent ? theme.shadow.e2 : theme.shadow.e1,
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl }]}
        />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, overflow: 'hidden' },
})

export default Card
