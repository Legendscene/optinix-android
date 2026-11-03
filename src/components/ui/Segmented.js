import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function Segmented({ options, value, onChange, style, size = 'md' }) {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.bg[3],
          borderRadius: theme.radius.md,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.id === value
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange?.(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: active ? theme.accent.dim : 'transparent',
                borderRadius: theme.radius.soft,
                paddingVertical: size === 'sm' ? 5 : 7,
                minHeight: 48,
                paddingHorizontal: 6,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Type
              variant="caption"
              style={{
                color: active ? theme.accent.ink : theme.colors.text.tertiary,
                fontFamily: active
                  ? theme.typography.family.bodySemi
                  : theme.typography.family.body,
              }}
            >
              {option.label}
            </Type>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', gap: 2 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})

export default Segmented
