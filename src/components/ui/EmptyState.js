import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function EmptyState({ glyph = '◇', title, body, action, style }) {
  const theme = useTheme()

  return (
    <View style={[styles.base, { paddingVertical: theme.spacing[8] }, style]}>
      <View
        style={[
          styles.glyphWrap,
          {
            borderColor: theme.accent.line,
            backgroundColor: theme.accent.dim,
            borderRadius: theme.radius['2xl'],
          },
        ]}
      >
        <Type variant="display3" tone="accent">
          {glyph}
        </Type>
      </View>
      <Type variant="h3" align="center" style={{ marginTop: theme.spacing[4] }}>
        {title}
      </Type>
      {body ? (
        <Type
          variant="bodySm"
          tone="tertiary"
          align="center"
          style={{ marginTop: 6, maxWidth: 280 }}
        >
          {body}
        </Type>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing[4] }}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  glyphWrap: {
    width: 64,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default EmptyState
