import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { usePreferences, useTheme } from '../theme/ThemeProvider'
import { Type } from '../components/ui/Type'
import { TabIcon } from './TabIcon'

const LABELS = {
  Dashboard: 'Home',
  Boost: 'Optimise',
  Games: 'Games',
  Monitor: 'Monitor',
  Settings: 'Settings',
}

export function TabBar({ state, navigation }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { preferences } = usePreferences()

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 6 }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.isDark ? 'rgba(11,13,17,0.96)' : 'rgba(255,255,255,0.97)',
            borderColor: theme.colors.border.base,
            borderRadius: theme.radius['2xl'],
            paddingHorizontal: 6,
            paddingVertical: 7,
            ...theme.shadow.e3,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const label = LABELS[route.name] ?? route.name
          const color = focused ? theme.accent.ink : theme.colors.text.tertiary

          return (
           <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                if (preferences.haptics) {
                  Haptics.selectionAsync().catch(() => {})
                }
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
              style={({ pressed }) => [
                styles.item,
                {
                  borderRadius: theme.radius.md,
                  backgroundColor: focused ? theme.accent.dim : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              {focused ? <View style={[styles.activeLine, { backgroundColor: theme.accent.color }]} /> : null}
              <TabIcon name={route.name} color={color} size={21} />
              <Type
                variant="eyebrow"
                style={{
                  marginTop: 3,
                  fontSize: 10.5,
                  letterSpacing: 0,
                  color: focused ? theme.accent.ink : theme.colors.text.tertiary,
                }}
              >
                {label}
              </Type>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14 },
  bar: { flexDirection: 'row', borderWidth: 1 },
  item: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, position: 'relative' },
  activeLine: { position: 'absolute', top: -7, width: 24, height: 2, borderRadius: 2 },
})

export default TabBar
