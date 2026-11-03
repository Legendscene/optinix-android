import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

const TONE_COLOR = {
  neutral: (theme) => theme.colors.text.primary,
  accent: (theme) => theme.accent.color,
  success: (theme) => theme.colors.semantic.green,
  warn: (theme) => theme.colors.semantic.yellow,
  danger: (theme) => theme.colors.semantic.red,
  info: (theme) => theme.colors.semantic.cyan,
  violet: (theme) => theme.colors.semantic.violet,
}

export function StatTile({ label, value, unit, tone = 'neutral', hint, progress, style, compact }) {
  const theme = useTheme()
  const color = (TONE_COLOR[tone] ?? TONE_COLOR.neutral)(theme)
  const clamped = progress == null ? null : Math.max(0, Math.min(100, progress))

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.isDark ? 'rgba(18,20,25,0.72)' : 'rgba(255,255,255,0.9)',
          borderColor: theme.colors.border.base,
          borderRadius: theme.radius.md,
          padding: compact ? 10 : 12,
        },
        style,
      ]}
    >
      <Type variant="eyebrow" tone="tertiary" style={{ fontSize: 8.5 }}>
        {label}
      </Type>
      <View style={styles.valueRow}>
        <Type variant="monoLg" style={{ color }}>
          {value ?? '--'}
        </Type>
        {unit ? (
          <Type variant="caption" tone="tertiary" style={{ marginBottom: 2 }}>
            {unit}
          </Type>
        ) : null}
      </View>
      {clamped != null ? (
        <View style={[styles.track, { backgroundColor: theme.colors.bg[4] }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${clamped}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      ) : hint ? (
        <Type variant="caption" tone="tertiary" numberOfLines={1} style={{ fontSize: 10 }}>
          {hint}
        </Type>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flex: 1, borderWidth: 1, gap: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: 3, borderRadius: 2 },
})

export default StatTile
