import React from 'react'
import { View } from 'react-native'
import { Type } from './Type'
import { useTheme } from '../../theme/ThemeProvider'

export function ResultNotice({ result }) {
  const theme = useTheme()
  if (!result) return null
  const message = typeof result === 'string' ? result : result.message ?? result.reason
  return (
    <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.bg[3], borderLeftWidth: 3, borderLeftColor: result.ok === false ? theme.colors.semantic.yellow : theme.accent.color }}>
      <Type variant="bodySm">{message}</Type>
    </View>
  )
}
