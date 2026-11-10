import React, { useEffect, useMemo } from 'react'
import { Linking, View } from 'react-native'
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import 'react-native-url-polyfill/auto'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium'
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold'
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium'
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold'
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold'

import RootNavigator from './src/navigation/RootNavigator'
import { ThemeProvider, usePreferences, useTheme } from './src/theme/ThemeProvider'
import { startMonitor, stopMonitor } from './src/services/monitor'
import { useGameLibrary } from './src/store/gameLibrary'
import { useMacros } from './src/store/macros'
import { validateMacro } from './src/lib/macros'
import { gamingConfig } from './src/services/gaming'
import gamingNative from './src/native/gaming'
import { startCloudSync } from './src/services/cloudSync'
import { handleAuthCallbackUrl } from './src/services/auth'
import { parseAuthCallbackUrl } from './src/lib/authUrls'
import adManager from './src/services/adManager'

SplashScreen.preventAutoHideAsync().catch(() => {})

/**
 * Deep links: normal optinix:// routes go to the navigator unchanged; auth
 * callbacks (PKCE code / implicit tokens / provider errors) NEVER reach the
 * navigator — they are handed to Supabase here, once (the blue dot dedupe in
 * handleAuthCallbackUrl guards the double delivery from both the browser
 * session and the OS relaunch).
 */
function routeOrAuthCallback(url) {
  const parsed = parseAuthCallbackUrl(url)
  if (['code', 'tokens', 'error'].includes(parsed.kind)) {
    handleAuthCallbackUrl(url)
    return null
  }
  return url
}

const linking = {
  prefixes: ['optinix://'],
  getInitialURL: async () => {
    const url = await Linking.getInitialURL()
    return url ? routeOrAuthCallback(url) : null
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const route = routeOrAuthCallback(url)
      if (route) listener(route)
    })
    return () => {
      sub?.remove?.()
    }
  },
  config: { screens: {
    Main: { screens: { Games: 'games', Dashboard: 'home', Boost: 'optimize', Monitor: 'monitor', Settings: 'settings' } },
    GamingTools: 'tools', MacroStudio: 'macros', Network: 'network', Sessions: 'sessions',
    ProcessManager: 'processes', StartupManager: 'startup', DeviceCheck: 'check',
  } },
}

function GamingConfiguration() {
  const theme = useTheme()
  const { preferences, hydrated, reducedMotion } = usePreferences()
  const library = useGameLibrary()
  const macros = useMacros()
  useEffect(() => {
    if (!hydrated || !library.ready || !macros.ready) return
    gamingNative.configure({ ...gamingConfig(preferences, theme, reducedMotion), games: library.data.games, macros: macros.data.macros.filter((macro) => validateMacro(macro).length === 0) })
  }, [preferences, hydrated, theme, reducedMotion, library.ready, library.data, macros.ready, macros.data])
  return null
}

function AppShell() {
  const theme = useTheme()
  const { preferences } = usePreferences()

  // Cloud sync + auth session refresh (optional feature; no-op when the
  // build has no Supabase env). Started once, for the whole app lifetime.
  useEffect(() => {
    startCloudSync()
    adManager.initialize().catch(() => {})
  }, [])

  useEffect(() => {
    startMonitor({ intervalMs: preferences.batteryConscious ? Math.max(5000, preferences.monitorIntervalMs) : preferences.monitorIntervalMs })
    return () => stopMonitor()
  }, [preferences.monitorIntervalMs, preferences.batteryConscious])

  const navTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme
    return {
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.accent.color,
        background: theme.colors.bg[0],
        card: theme.colors.bg[1],
        text: theme.colors.text.primary,
        border: theme.colors.border.base,
        notification: theme.accent.color,
      },
    }
  }, [theme])

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg[0] }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme} linking={linking}>
        <RootNavigator />
      </NavigationContainer>
      <GamingConfiguration />
    </View>
  )
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: '#06070b' }} />
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
