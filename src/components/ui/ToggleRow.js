import React from 'react'
import { Switch, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function ToggleRow({ title, detail, value, onChange, disabled = false }) {
  const theme = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Type variant="bodySemi">{title}</Type>
        {detail ? <Type variant="caption" tone="tertiary">{detail}</Type> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={Boolean(value)} disabled={disabled} onValueChange={onChange}
        trackColor={{ false: theme.colors.bg[4], true: theme.accent.dim }}
        thumbColor={value ? theme.accent.color : theme.colors.text.tertiary}
      />
    </View>
  )
}
