import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Badge } from './Badge'
import { Type } from './Type'

const SEVERITY = {
  warning: { tone: 'warn', label: 'WARNING' },
  critical: { tone: 'danger', label: 'CRITICAL' },
  info: { tone: 'info', label: 'INFO' },
  success: { tone: 'success', label: 'OK' },
}

export function AlertBanner({ severity = 'warning', title, detail, style }) {
  const theme = useTheme()
  const spec = SEVERITY[severity] ?? SEVERITY.warning
  const dotColor =
    spec.tone === 'danger'
      ? theme.colors.semantic.red
      : spec.tone === 'warn'
        ? theme.colors.semantic.yellow
        : spec.tone === 'success'
          ? theme.colors.semantic.green
          : theme.colors.semantic.cyan

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border.base,
          backgroundColor: theme.isDark ? 'rgba(20,22,28,0.8)' : 'rgba(255,255,255,0.9)',
          padding: 12,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Type variant="bodySemi" style={{ fontSize: 13 }}>
            {title}
          </Type>
          <Badge label={spec.label} tone={spec.tone} />
        </View>
        {detail ? (
          <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
            {detail}
          </Type>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', borderWidth: 1, gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
})

export default AlertBanner
