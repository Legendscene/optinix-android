import React from 'react'
import { TextInput, View } from 'react-native'
import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function Field({ label, hint, error, style, ...props }) {
  const theme = useTheme()
  return (
    <View style={[{ gap: 7 }, style]}>
      {label ? <Type variant="label">{label}</Type> : null}
      <TextInput
        accessibilityLabel={label ?? props.placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        selectionColor={theme.accent.color}
        autoCorrect={false}
        {...props}
        style={{
          minHeight: 50, borderWidth: 1, borderRadius: theme.radius.md,
          borderColor: error ? theme.colors.semantic.red : theme.colors.border.light,
          backgroundColor: theme.colors.bg[2], color: theme.colors.text.primary,
          fontFamily: theme.typography.family.body, fontSize: 15,
          paddingHorizontal: 14, paddingVertical: 12,
          textAlignVertical: props.multiline ? 'top' : 'center',
        }}
      />
      {error || hint ? <Type variant="caption" tone={error ? 'danger' : 'tertiary'}>{error || hint}</Type> : null}
    </View>
  )
}
