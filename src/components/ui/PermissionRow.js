import React from 'react'
import { StyleSheet, View } from 'react-native'

import { useTheme } from '../../theme/ThemeProvider'
import { Badge } from './Badge'
import { Button } from './Button'
import { Type } from './Type'

export function PermissionRow({ title, description, granted, onGrant, grantLabel = 'Grant' }) {
  const theme = useTheme()

  return (
    <View style={[styles.base, { paddingVertical: theme.spacing[3] }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Type variant="bodySm">{title}</Type>
          <Badge
            label={granted ? 'GRANTED' : 'REQUIRED'}
            tone={granted ? 'success' : 'warn'}
          />
        </View>
        {description ? (
          <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
            {description}
          </Type>
        ) : null}
      </View>
      {!granted ? (
        <Button
          label={grantLabel}
          size="sm"
          variant="ghost"
          onPress={onGrant}
          style={{ marginLeft: theme.spacing[3] }}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})

export default PermissionRow
