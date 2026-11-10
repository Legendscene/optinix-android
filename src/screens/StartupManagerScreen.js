/**
 * StartupManagerScreen — capability-based auto-start management.
 *
 * Android (AOSP) has no auto-start page; vendors bury per-app start managers
 * inside their own security apps. This screen probes what actually exists on
 * the current device (native getStartupSupport) and:
 *   - opens the vendor auto-start page when one genuinely resolves,
 *   - shows an honest "Startup control is not supported on this device"
 *     state when it does not — never a fake toggle,
 *   - routes per-app battery / App info actions that Android truly supports.
 * Status is always described, never invented: Android exposes no cross-app
 * autostart reading, so the app can't show on/off values for other apps.
 */
import React, { useCallback, useRef, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { EmptyState } from '../components/ui/EmptyState'
import { ResultNotice } from '../components/ui/ResultNotice'
import { Badge } from '../components/ui/Badge'
import { GameIcon } from '../components/gaming/GameArtwork'
import appsNative from '../native/apps'
import gamingNative from '../native/gaming'
import { startupConsequences, startupSupportCopy, perAppControlsAvailable } from '../lib/startupOem'
import { lastUsedLabel } from '../lib/processUi'
import { usePermissions } from '../hooks/usePermissions'

export default function StartupManagerScreen() {
  const permissions = usePermissions()
  const [support, setSupport] = useState(null)
  const [apps, setApps] = useState(null)
  const [note, setNote] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    const [nextSupport, usage] = await Promise.all([
      appsNative.getStartupSupport(),
      appsNative.hasUsageAccess(),
    ])
    const list = usage ? await appsNative.getRecentApps(168) : []
    if (!alive.current) return
    setSupport(nextSupport)
    setApps(usage ? (Array.isArray(list) ? list : []) : [])
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

  const copy = startupSupportCopy(support)
  const perApp = perAppControlsAvailable(support)

  const openVendorPage = async () => {
    const result = await appsNative.openAutoStartSettings()
    setNote(result?.message ?? null)
  }

  const openFallback = async () => {
    const result = await gamingNative.openSettings('battery')
    setNote(result?.message ?? null)
  }

  const manageApp = async (app) => {
    if (perApp) {
      await openVendorPage()
      return
    }
    const ok = await appsNative.openAppInfo(app.packageName)
    if (!ok) setNote(`Android could not open the App info page for ${app.label}.`)
  }

  return (
    <Screen scroll={false} contentStyle={{ padding: 0 }}>
      <FlatList
        data={permissions.usageAccess ? (apps ?? []) : []}
        style={{ flex: 1 }}
        keyExtractor={(app) => app.packageName}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
        ListHeaderComponent={(
          <View style={{ gap: 18, marginBottom: 4 }}>
            <PageHeader
              title="Startup Manager"
              subtitle="Find where your phone hides per-app auto-start switches — and change them safely, inside your phone's own controls."
            />
            <Card accent style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Type variant="h2" style={{ flex: 1 }}>{copy.title}</Type>
                <Badge
                  tone={copy.tone === 'supported' ? 'success' : copy.tone === 'unsupported' ? 'warn' : 'neutral'}
                  label={copy.tone === 'supported' ? 'Available' : copy.tone === 'unsupported' ? 'Unsupported' : 'Unknown'}
                />
              </View>
              <Type variant="bodySm" tone="secondary">{copy.body}</Type>
              {copy.steps.length ? (
                <View style={{ gap: 4 }}>
                  {copy.steps.map((step, index) => (
                    <Type key={`${step}-${index}`} variant="caption" tone="tertiary">• {step}</Type>
                  ))}
                </View>
              ) : null}
              {copy.tone === 'supported' ? (
                <Button label={support?.directAutoStart ? 'Open auto-start page' : 'Open vendor controls'} onPress={openVendorPage} />
              ) : copy.tone === 'unsupported' ? (
                <Button label="Open Android battery settings" onPress={openFallback} variant="ghost" />
              ) : null}
            </Card>
            <Card style={{ gap: 8 }}>
              <Type variant="h2">Before you change auto-start</Type>
              <Type variant="bodySm" tone="secondary">{startupConsequences()[0]}</Type>
              <Type variant="bodySm" tone="secondary">{startupConsequences()[1]}</Type>
              <Type variant="caption" tone="tertiary">{startupConsequences()[2]}</Type>
            </Card>
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Type variant="h2" style={{ flex: 1 }}>Optinix&apos;s own startup</Type>
                <Badge tone="neutral" label="Nothing hidden" />
              </View>
              <Type variant="bodySm" tone="secondary">
                Optinix does not start itself when your phone reboots — the app declares no boot permission, so there is nothing to manage or un-check. Sessions and tools only run when you start them.
              </Type>
            </Card>
            {!permissions.usageAccess ? (
              <Card accent style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Type variant="h2" style={{ flex: 1 }}>Usage access needed</Type>
                  <Badge tone="warn" label="Missing" />
                </View>
                <Type variant="bodySm" tone="secondary">
                  Usage Access supplies the recently-active app list on Android 10–16. It does not expose whether an app may auto-start. Change those settings in the phone&apos;s controls.
                </Type>
                <Button label="Open Usage Access settings" onPress={permissions.grantUsage} />
              </Card>
            ) : null}
          </View>
        )}
        ListEmptyComponent={apps == null ? (
          <EmptyState glyph="◌" title="Checking your phone…" body="Probing which auto-start managers exist on this device." />
        ) : (permissions.usageAccess && apps.length === 0) ? (
          <EmptyState
            glyph="◈"
            title="No recent app activity"
            body="Android returned no recently active apps, so there are no per-app rows to show. Open a few apps, then pull down to refresh."
            action={<Button label="Refresh" variant="ghost" onPress={onRefresh} />}
          />
        ) : null}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <GameIcon game={item} size={42} />
            <View style={{ flex: 1, gap: 4 }}>
              <Type variant="h3">{item.label}</Type>
              <Type variant="caption" tone="tertiary" numberOfLines={1}>{item.packageName}</Type>
              <Type variant="caption" tone="secondary">
                {lastUsedLabel(item)}
              </Type>
            </View>
            <View style={{ gap: 6, minWidth: 116 }}>
              {perApp ? (
                <Button label="Vendor controls" size="sm" onPress={() => manageApp(item)} />
              ) : (
                <Type variant="caption" tone="tertiary" style={{ textAlign: 'right' }}>Auto-start page unavailable</Type>
              )}
              <Button
                label="Battery settings"
                size="sm"
                variant="ghost"
                onPress={async () => {
                  const ok = await appsNative.openAppInfo(item.packageName)
                  if (!ok) setNote(`Android could not open the settings page for ${item.label}.`)
                }}
              />
            </View>
          </Card>
        )}
      />
      <ResultNotice result={note} />
    </Screen>
  )
}
