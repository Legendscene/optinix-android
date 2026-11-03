import React from 'react'
import { View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Type } from './Type'
import { Button } from './Button'

export function PageHeader({ title, subtitle, back = true, action }) {
  const navigation = useNavigation()
  return (
    <View style={{ gap: 12 }}>
      {back || action ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          {back ? <Button label="Back" variant="ghost" size="sm" onPress={() => navigation.goBack()} /> : <View />}
          {action}
        </View>
      ) : null}
      <Type variant="h1" accessibilityRole="header">{title}</Type>
      {subtitle ? <Type variant="bodySm" tone="secondary">{subtitle}</Type> : null}
    </View>
  )
}
