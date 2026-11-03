import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Type } from './Type'

export function SectionHeader({ eyebrow, title, action, style }) {
  const theme = useTheme()

  return (
    <View style={[styles.base, style]}>
      <View style={styles.text}>
        {eyebrow ? (
          <Type variant="eyebrow" tone="accent" style={{ marginBottom: 4 }}>
            {eyebrow}
          </Type>
        ) : null}
        {title ? <Type variant="h1">{title}</Type> : null}
      </View>
      {action ? <View style={{ marginLeft: theme.spacing[3] }}>{action}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  text: { flex: 1 },
})

export default SectionHeader
