import React from 'react'
import { View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import RootTabs from './RootTabs'
import OnboardingScreen from '../screens/OnboardingScreen'
import AddGamesScreen from '../screens/AddGamesScreen'
import GameProfileScreen from '../screens/GameProfileScreen'
import SessionsScreen from '../screens/SessionsScreen'
import GamingToolsScreen from '../screens/GamingToolsScreen'
import MacroStudioScreen from '../screens/MacroStudioScreen'
import MacroEditorScreen from '../screens/MacroEditorScreen'
import NetworkScreen from '../screens/NetworkScreen'
import ProcessManagerScreen from '../screens/ProcessManagerScreen'
import StartupManagerScreen from '../screens/StartupManagerScreen'
import DeviceCheckScreen from '../screens/DeviceCheckScreen'
import AuthScreen from '../screens/AuthScreen'
import AccountScreen from '../screens/AccountScreen'

const Stack = createNativeStackNavigator()

const MAIN_ROUTES = [
  ['Main', RootTabs],
  ['AddGames', AddGamesScreen],
  ['GameProfile', GameProfileScreen],
  ['Sessions', SessionsScreen],
  ['GamingTools', GamingToolsScreen],
  ['MacroStudio', MacroStudioScreen],
  ['MacroEditor', MacroEditorScreen],
  ['Network', NetworkScreen],
  ['ProcessManager', ProcessManagerScreen],
  ['StartupManager', StartupManagerScreen],
  ['DeviceCheck', DeviceCheckScreen],
  ['Auth', AuthScreen],
  ['Account', AccountScreen],
]

const ANIMATION = (reducedMotion) => ({
  headerShown: false,
  animation: reducedMotion ? 'none' : 'slide_from_right',
  contentStyle: { backgroundColor: 'transparent' },
})

export default function RootNavigator() {
  const theme = useTheme()
  const { preferences, hydrated, reducedMotion } = usePreferences()
  // Hydration first: initialRouteName only counts at mount, so wait until we
  // know whether this is a first run.
  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.bg[0] }} />
  }
  const needsOnboarding = preferences.onboardingDone === false

  const screenOptions = {
    ...ANIMATION(reducedMotion),
    contentStyle: { backgroundColor: theme.colors.bg[0] },
  }

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName={needsOnboarding ? 'Onboarding' : 'Main'}>
      {needsOnboarding ? <Stack.Screen name="Onboarding" component={OnboardingScreen} /> : null}
      {MAIN_ROUTES.map(([name, component]) => (
        <Stack.Screen key={name} name={name} component={component} />
      ))}
    </Stack.Navigator>
  )
}
