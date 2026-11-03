import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function Bar({ value, max = 100, tone = 'accent', height = 6, style }) {
  const theme = useTheme()
  const ratio = value == null || max <= 0 ? 0 : Math.max(0, Math.min(1, value / max))
  const color =
    tone === 'success'
      ? theme.colors.semantic.green
      : tone === 'warn'
        ? theme.colors.semantic.yellow
        : tone === 'danger'
          ? theme.colors.semantic.red
          : tone === 'info'
            ? theme.colors.semantic.cyan
            : theme.accent.color

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: theme.colors.bg[4], height, borderRadius: height / 2 },
        style,
      ]}
    >
      <View
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function CoreBars({ cores = [], style }) {
  return (
    <View style={[styles.cores, style]}>
      {cores.map((value, index) => (
        <View key={`core-${index}`} style={styles.core}>
          <Type variant="eyebrow" tone="tertiary" style={{ fontSize: 7.5 }}>
            C{index}
          </Type>
          <Bar
            value={value}
            tone={value == null ? 'neutral' : value > 85 ? 'danger' : value > 65 ? 'warn' : 'accent'}
            height={34}
            style={{ width: 6 }}
          />
        </View>
      ))}
      {cores.length === 0 ? (
        <Type variant="caption" tone="tertiary">
          Core data unavailable
        </Type>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  cores: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 52 },
  core: { alignItems: 'center', gap: 4 },
})

export default Bar
