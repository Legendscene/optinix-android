/**
 * ProcessManagerScreen — review running/recently active apps and route the
 * user to the REAL system controls for them.
 *
 * Honesty contract: an ordinary (non-root) app cannot terminate other
 * processes — on Android 14+ killBackgroundProcesses() only reaches the
 * calling app's own processes. So this screen never shows a fake "Kill"
 * button and never claims something was closed. The actions offered are the
 * ones Android genuinely supports: App info, per-app battery settings, and a
 * guided path to the system's own Force-stop control (inside App info).
 * Requires Usage Access to see the list at all — the permission state is
 * shown and explained instead of pretending the list is empty.
 */
import React, { useCallback, useRef, useState } from 'react'
import { FlatList, Platform, RefreshControl, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { EmptyState } from '../components/ui/EmptyState'
import { ResultNotice } from '../components/ui/ResultNotice'
import { Badge } from '../components/ui/Badge'
import { Field } from '../components/ui/Field'
import { GameIcon } from '../components/gaming/GameArtwork'
import appsNative from '../native/apps'
import { filterApps, lastUsedLabel, screenTimeLabel, sortApps, SORT_OPTIONS, CATEGORY_OPTIONS, summarizeMemory } from '../lib/processUi'
import { formatBytes, formatPercent } from '../lib/format'
import { usePermissions } from '../hooks/usePermissions'
import { useMonitor } from '../services/monitor'

export default function ProcessManagerScreen() {
  const permissions = usePermissions()
  const { metrics } = useMonitor()
  const [apps, setApps] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [category, setCategory] = useState('all')
  const [note, setNote] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    const granted = await appsNative.hasUsageAccess()
    if (!granted) { if (alive.current) { setApps([]); setNote(null) } return false }
    const list = await appsNative.getRecentApps(24)
    if (alive.current) setApps(Array.isArray(list) ? list : [])
    return true
  }, [])

  useFocusEffect(useCallback(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await load() } finally { if (alive.current) setRefreshing(false) }
  }, [load])

  const memory = summarizeMemory({ ramPercent: metrics?.ramPercent ?? metrics?.memory?.percent, ramUsedBytes: metrics?.ramUsedBytes ?? metrics?.memory?.usedBytes, ramTotalBytes: metrics?.ramTotalBytes ?? metrics?.memory?.totalBytes })
  const visible = sortApps(filterApps(apps ?? [], search, category), sort)

  const openAppInfo = async (app) => {
    const ok = await appsNative.openAppInfo(app.packageName)
    setNote(ok
      ? `Opened App info for ${app.label}. Tap "Force stop" in system settings to end its background processes.`
      : `Android could not open the App info page for ${app.label}.`)
  }

  const openBattery = async (app) => {
    // The per-app battery screen is not publicly routable on every Android
    // version; App info is the reliable entry to "Battery" for all apps.
    const ok = await appsNative.openAppInfo(app.packageName)
    setNote(ok
      ? `${app.label}: use the Battery section here for Background usage / Unrestricted decisions.`
      : `Android could not open the settings page for ${app.label}.`)
  }

  return (
    <Screen scroll={false} contentStyle={{ padding: 0 }}>
      <FlatList
        data={visible}
        style={{ flex: 1 }}
        keyExtractor={(app) => app.packageName}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
        ListHeaderComponent={(
          <View style={{ gap: 18, marginBottom: 4 }}>
            <PageHeader
              title="Process Manager"
              subtitle="See which apps were recently active and manage their background behaviour with the controls Android actually provides."
            />
            <Card style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Type variant="h2" style={{ flex: 1 }}>Memory right now</Type>
                <Type variant="mono">{formatPercent(memory.usedPercent)}</Type>
              </View>
              <Type variant="bodySm" tone="secondary">
                {memory.usedBytes != null
                  ? `${formatBytes(memory.usedBytes)} measured in use${memory.totalBytes != null ? ` of ${formatBytes(memory.totalBytes)}` : ''}`
                  : 'Memory figures are not available.'}
              </Type>
              <Type variant="caption" tone="tertiary">
                Device-level measurement by Optinix. Per-app memory readings are not exposed by Android, and Optinix does not pretend otherwise.
              </Type>
            </Card>
            {!permissions.usageAccess ? (
              <Card accent style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Type variant="h2" style={{ flex: 1 }}>Usage access needed</Type>
                  <Badge tone="warn" label="Missing" />
                </View>
                <Type variant="bodySm" tone="secondary">
                  Usage Access shows recently-active apps on Android 10–16. This is activity history, not a list of live processes. These readings stay on your phone.
                </Type>
                <Button label="Open Usage Access settings" onPress={permissions.grantUsage} />
              </Card>
            ) : null}
            {apps != null && apps.length === 0 && permissions.usageAccess ? (
              <EmptyState
                glyph="🧭"
                title="No recent app activity"
                body="Usage access is granted, but Android reported no app activity for the window. Open a few apps or pull down to refresh."
                action={<Button label="Refresh" variant="ghost" onPress={onRefresh} />}
              />
            ) : null}
              {(apps != null && apps.length > 0) ? (
                <Card style={{ gap: 12 }}>
                  <Field label="Search apps" value={search} onChangeText={setSearch} placeholder="Name or package" />
                  <View style={{ gap: 6 }}>
                    <Type variant="eyebrow" tone="tertiary" style={{ fontSize: 9 }}>FILTER CATEGORY</Type>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {CATEGORY_OPTIONS.map((option) => (
                        <Button
                          key={option.id}
                          label={option.label}
                          size="sm"
                          variant={category === option.id ? 'primary' : 'ghost'}
                          onPress={() => setCategory(option.id)}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={{ gap: 6 }}>
                    <Type variant="eyebrow" tone="tertiary" style={{ fontSize: 9 }}>SORT BY</Type>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {SORT_OPTIONS.map((option) => (
                        <Button
                          key={option.id}
                          label={option.label}
                          size="sm"
                          variant={sort === option.id ? 'primary' : 'ghost'}
                          onPress={() => setSort(option.id)}
                        />
                      ))}
                    </View>
                  </View>
                </Card>
              ) : null}
            <Type variant="bodySm" tone="tertiary">
              {Number(Platform.Version) >= 34
                ? 'Android 14–16 restrict background-process killing to the calling app. Use Force stop in App info to stop another app yourself.'
                : 'Android 10–13 allow limited background-process requests with an extra permission, but they cannot force-stop an app or verify lasting memory savings. Optinix uses Force stop in App info instead.'}
            </Type>
          </View>
        )}
        ListEmptyComponent={apps == null ? (
          <EmptyState glyph="◌" title="Reading app activity…" body="One moment — Android is being asked for the recent app list." />
        ) : search.trim() !== '' ? (
          <EmptyState
            glyph="🔍"
            title={`No apps match "${search.trim()}"`}
            body="Search covers the label and package name of the recently active apps. Clear the search to see the full list again."
            action={<Button label="Clear search" variant="ghost" onPress={() => setSearch('')} />}
          />
        ) : null}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <GameIcon game={item} size={42} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Type variant="h3">{item.label}</Type>
                {item.isGame ? <Badge label="Game" tone="accent" /> : item.isSystem ? <Badge label="System" tone="neutral" /> : <Badge label="User App" tone="info" />}
              </View>
              <Type variant="caption" tone="tertiary" numberOfLines={1}>{item.packageName}</Type>
              <Type variant="caption" tone="secondary">
                {lastUsedLabel(item)}{screenTimeLabel(item) ? ` • ${screenTimeLabel(item)} on screen` : ''}
              </Type>
            </View>
            <View style={{ gap: 6 }}>
              <Button label="Force stop" size="sm" onPress={() => openAppInfo(item)} />
              <Button label="Battery" size="sm" variant="ghost" onPress={() => openBattery(item)} />
            </View>
          </Card>
        )}
      />
      <ResultNotice result={note} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <Button
          label="Open Android app management"
          variant="ghost"
          onPress={async () => {
            const ok = await appsNative.openAppManagementSettings()
            if (!ok) setNote('Android could not open the app management page.')
          }}
        />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8, textAlign: 'center' }}>
          System-only actions (like Force stop) live inside each app&apos;s App info page — opened for you above.
        </Type>
      </View>
    </Screen>
  )
}
