import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function Row({ title, subtitle, value, right, left, onPress, style, dense = false }) {
  const theme = useTheme()
  const content = (
    <View style={[styles.base, { paddingVertical: dense ? 9 : 12 }, style]}>
      {left ? <View style={{ marginRight: theme.spacing[3] }}>{left}</View> : null}
      <View style={styles.text}>
        <Type variant="bodySm" tone="primary" numberOfLines={1}>
          {title}
        </Type>
        {subtitle ? (
          <Type variant="caption" tone="tertiary" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Type>
        ) : null}
      </View>
      {value ? (
        <Type variant="mono" tone="secondary" style={{ marginLeft: theme.spacing[2] }}>
          {value}
        </Type>
      ) : null}
      {right ? <View style={{ marginLeft: theme.spacing[3] }}>{right}</View> : null}
    </View>
  )

  if (!onPress) return content

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {content}
    </Pressable>
  )
}

export function Divider({ style }) {
  const theme = useTheme()
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.base }, style]} />
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
})

export default Row
