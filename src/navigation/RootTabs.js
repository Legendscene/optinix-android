import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

import DashboardScreen from '../screens/DashboardScreen'
import BoostScreen from '../screens/BoostScreen'
import GamesScreen from '../screens/GamesScreen'
import MonitorScreen from '../screens/MonitorScreen'
import SettingsScreen from '../screens/SettingsScreen'
import { TabBar } from './TabBar'

const Tab = createBottomTabNavigator()

export default function RootTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Boost" component={BoostScreen} />
      <Tab.Screen name="Games" component={GamesScreen} />
      <Tab.Screen name="Monitor" component={MonitorScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
