import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../../theme/ThemeProvider'

export function Screen({
  children,
  scroll = true,
  contentStyle,
  style,
  edges = ['top'],
  bottomInset = 130,
}) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const gradient = theme.isDark
    ? theme.gradients.hero
    : ['#fbfcfe', '#eef1f7', '#f9fafc']

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg[0] }, style]}>
      <LinearGradient colors={gradient} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.gridWrap}>
        <View style={[styles.gridLine, { top: '18%', backgroundColor: theme.colors.bg.grid }]} />
        <View style={[styles.gridLine, { top: '42%', backgroundColor: theme.colors.bg.grid }]} />
        <View style={[styles.gridLine, { top: '68%', backgroundColor: theme.colors.bg.grid }]} />
      </View>
      <SafeAreaView style={styles.safe} edges={edges}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
               { paddingBottom: bottomInset + insets.bottom, gap: theme.density.sectionGap },
              contentStyle,
            ]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, width: '100%', maxWidth: 760, alignSelf: 'center' },
  gridWrap: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
})

export default Screen
