import React, { useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import appsNative from '../../native/apps'
import { useTheme } from '../../theme/ThemeProvider'
import { Type } from '../ui/Type'

const icons = new Map()

export function GameIcon({ game, size = 54 }) {
  const theme = useTheme()
  const [loaded, setLoaded] = useState(null)
  const uri = icons.get(game?.packageName) ?? (loaded && loaded.packageName === game?.packageName ? loaded.uri : null)
  useEffect(() => {
    let alive = true
    if (game?.packageName && game.installed !== false && !icons.has(game.packageName)) {
      appsNative.getAppIcon(game.packageName, 128).then((icon) => {
        if (icon) {
          if (icons.size > 100) icons.delete(icons.keys().next().value)
          icons.set(game.packageName, icon)
        }
        if (alive) setLoaded({ packageName: game.packageName, uri: icon })
      })
    }
    return () => { alive = false }
  }, [game?.packageName, game?.installed])
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.24) }
  return uri
    ? <Image source={{ uri }} style={style} accessibilityIgnoresInvertColors />
    : <View style={[style, { backgroundColor: theme.accent.dim, alignItems: 'center', justifyContent: 'center' }]}><Type variant="display3" tone="accent">{game?.label?.slice(0, 1) ?? 'O'}</Type></View>
}

export function GameArtwork({ game, children }) {
  const theme = useTheme()
  return (
    <View style={{ borderRadius: theme.radius['3xl'], overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border.light, backgroundColor: theme.colors.bg[1] }}>
      <LinearGradient colors={theme.isDark ? ['#14262e', '#102127', '#0b0d12'] : ['#d5f4ed', '#eaf6f5', '#ffffff']} style={StyleSheet.absoluteFill} />
      <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Defs><SvgGradient id="cartridge" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={theme.accent.color} stopOpacity="0.45" /><Stop offset="1" stopColor={theme.colors.semantic.violet} stopOpacity="0.05" /></SvgGradient></Defs>
        <Path d="M210 -80 L470 70 L340 285 L90 140 Z" fill="url(#cartridge)" />
        <Path d="M275 -80 L475 42 L337 271 L144 149 Z" fill="none" stroke={theme.accent.color} strokeOpacity="0.28" strokeWidth="1" />
        <Path d="M304 -50 L440 48 L330 230 L195 137 Z" fill="none" stroke={theme.colors.text.primary} strokeOpacity="0.1" />
      </Svg>
      <View style={{ padding: 24, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <GameIcon game={game} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Type variant="label" tone="accentInk">{game ? 'Ready to play' : 'Your gaming space'}</Type>
            <Type variant="display3" numberOfLines={2}>{game?.label ?? 'Make room for play.'}</Type>
          </View>
        </View>
        {children}
      </View>
    </View>
  )
}
