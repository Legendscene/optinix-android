import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

const TONES = {
  neutral: (theme) => ({ bg: theme.colors.bg[3], fg: theme.colors.text.secondary }),
  accent: (theme) => ({ bg: theme.accent.dim, fg: theme.accent.ink }),
  success: (theme) => ({ bg: theme.colors.semantic.greenDim, fg: theme.colors.semantic.green }),
  warn: (theme) => ({ bg: theme.colors.semantic.yellowDim, fg: theme.colors.semantic.yellow }),
  danger: (theme) => ({ bg: theme.colors.semantic.redDim, fg: theme.colors.semantic.red }),
  info: (theme) => ({ bg: theme.colors.semantic.cyanDim, fg: theme.colors.semantic.cyan }),
  violet: (theme) => ({ bg: theme.colors.semantic.violetDim, fg: theme.colors.semantic.violet }),
}

export function Badge({ label, tone = 'neutral', style, uppercase = true }) {
  const theme = useTheme()
  const palette = (TONES[tone] ?? TONES.neutral)(theme)

  return (
    <View style={[styles.base, { backgroundColor: palette.bg, borderRadius: theme.radius.pill }, style]}>
      <Type
        variant="eyebrow"
        style={{
          color: palette.fg,
          textTransform: uppercase ? 'uppercase' : 'none',
          fontSize: 9,
        }}
      >
        {label}
      </Type>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4 },
})

export default Badge
