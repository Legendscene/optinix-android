import React, { useCallback, useState } from 'react'
import { Alert, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { ToggleRow } from '../components/ui/ToggleRow'
import { Segmented } from '../components/ui/Segmented'
import { ResultNotice } from '../components/ui/ResultNotice'
import { formatDuration } from '../lib/format'
import { useGamingRuntime } from '../hooks/useGamingRuntime'
import gamingNative from '../native/gaming'
import { gamingConfig, requestSessionNotifications } from '../services/gaming'
import { usePreferences, useTheme } from '../theme/ThemeProvider'

export default function GamingToolsScreen({ navigation }) {
  const theme = useTheme()
  const { preferences, update, reducedMotion } = usePreferences()
  const { runtime, capabilities, refresh } = useGamingRuntime()
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [captures, setCaptures] = useState([])
  const disabled = preferences.overlayVisibility === 'disabled'
  useFocusEffect(useCallback(() => {
    let alive = true
    if (runtime.capture?.active) return () => { alive = false }
    gamingNative.getCaptures().then((items) => { if (alive) setCaptures(Array.isArray(items) ? items : []) })
    return () => { alive = false }
  }, [runtime.capture?.active]))
  const perform = async (operation) => {
    if (busy) return
    setBusy(true)
    try { setNote(await operation()); await refresh() }
    catch (e) { setNote({ ok: false, message: e.message }) }
    finally { setBusy(false) }
  }
  const start = async (showOverlay) => {
    const config = gamingConfig(preferences, theme, reducedMotion)
    if (preferences.notifications || preferences.overlayVisibility === 'notification') await requestSessionNotifications()
    await gamingNative.configure(config)
    return gamingNative.startSession({ ...config, showOverlay, profile: { id: 'custom', name: 'Custom session', overlay: showOverlay, intervalMs: config.intervalMs, reminderMinutes: preferences.reminderMinutes } })
  }
  return <Screen bottomInset={40}>
    <PageHeader title="Gaming control center" subtitle="Session tools that work within Android's permissions. Start a session before opening your game." />
    <Card accent style={{ gap: 16 }}>
      <Type variant="h2">{runtime.session?.gameLabel ?? 'Ready for your next session'}</Type>
      <Type variant="monoXl" style={{ fontSize: 38 }}>{runtime.session ? formatDuration(runtime.session.durationMs) : '00:00'}</Type>
      <Type variant="bodySm" tone="secondary">{runtime.session ? `${runtime.session.profileName} • ${runtime.session.paused ? 'Timer paused' : 'Timer running'}` : 'The timer stops when you end the session or lock the screen.'}</Type>
      {runtime.running ? <>
        <Button label={runtime.session?.paused ? 'Resume timer' : 'Pause timer'} onPress={() => perform(() => gamingNative.timer(runtime.session?.paused ? 'resume' : 'pause'))} />
        <Button label="End session & stop tools" variant="ghost" onPress={() => perform(gamingNative.endSession)} />
      </> : disabled ? <>
        <ResultNotice result="Gaming service is completely disabled. The timer and both HUDs stay stopped until you change the visibility mode." />
        <Button label="Change HUD visibility" onPress={() => navigation.navigate('Main', { screen: 'Settings' })} />
      </> : <>
        <Button label={capabilities.overlay ? 'Start floating HUD' : 'Enable overlay access'} loading={busy} onPress={() => perform(() => capabilities.overlay ? start(true) : gamingNative.openSettings('overlay'))} />
        <Button label="Start timer without overlay" variant="ghost" loading={busy} onPress={() => perform(() => start(false))} />
      </>}
    </Card>
    <ResultNotice result={note || runtime.error} />
    {capabilities.overlayReason ? <ResultNotice result={capabilities.overlayReason} /> : null}
    {runtime.running ? (
      <Card style={{ gap: 12 }}>
        <Type variant="h2">HUD visibility</Type>
        <Type variant="bodySm" tone="secondary">
          Hide removes the control HUD while keeping the session timer running. Reopen requests the dashboard over your next foreground library game. Notification-only mode returns to no handle when minimized. Completely Disabled in Settings stops the whole gaming service.
        </Type>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Hide HUD" loading={busy} onPress={() => perform(() => gamingNative.setOverlayVisible(false))} />
          <Button label="Reopen / enable HUD" variant="ghost" loading={busy} onPress={() => perform(() => gamingNative.setOverlayVisible(true))} />
        </View>
      </Card>
    ) : null}
    {runtime.settings?.length ? <Card style={{ gap: 12 }}><Type variant="h3">Last profile application</Type>{runtime.settings.map((setting, index) => <View key={`${setting.setting}-${index}`} style={{ gap: 3 }}><Type variant="label" tone={setting.status === 'applied' ? 'accentInk' : 'warn'}>{setting.setting}: {setting.status}</Type><Type variant="bodySm" tone="secondary">{setting.message}</Type></View>)}</Card> : null}
    <Card style={{ gap: 12 }}>
      <Type variant="h2">Focus & interruptions</Type>
      <Type variant="bodySm" tone="secondary">{capabilities.dndActive ? 'Optinix rule requested. Other Android DND rules may also be active.' : 'Optinix DND rule is off. Your system DND may still be enabled.'}</Type>
      <Button label={!capabilities.dndSupported ? 'Open system DND settings' : !capabilities.dndAccess ? 'Allow notification-policy access' : capabilities.dndActive ? 'Release Optinix DND rule' : 'Enable Optinix DND rule'} variant="ghost" onPress={() => perform(() => !capabilities.dndSupported ? gamingNative.openSettings('dnd') : !capabilities.dndAccess ? gamingNative.openSettings('dnd-access') : gamingNative.setDnd(!capabilities.dndActive))} />
      <Button label="Notification preferences" variant="ghost" onPress={() => perform(() => gamingNative.openSettings('notifications'))} />
      <ToggleRow title="Session notifications" detail="Optional break reminders. Android always requires a foreground-service notification while a session runs." value={preferences.notifications} onChange={async (value) => { if (!value || await requestSessionNotifications()) update({ notifications: value }); else setNote('Notifications denied. Session tools remain available in the app and HUD.') }} />
    </Card>
    <Card style={{ gap: 12 }}>
      <Type variant="h2">Break reminders</Type>
      <Type variant="bodySm" tone="tertiary">Default for manually started sessions. Per-game profiles have their own interval.</Type>
      <Segmented options={[0, 15, 30, 45, 60].map((id) => ({ id, label: id ? `${id}m` : 'Off' }))} value={preferences.reminderMinutes} onChange={(reminderMinutes) => update({ reminderMinutes })} />
    </Card>
    <Card style={{ gap: 12 }}>
      <Type variant="h2">Capture the moment</Type>
      {capabilities.captureAvailable === false ? <ResultNotice result="Android screen capture is unavailable on this device. The controls below will report the unsupported result." /> : null}
      <Type variant="bodySm" tone="secondary">Android asks for screen/app consent each time. Silent recording, up to 10 minutes. Secure windows stay protected.</Type>
      <ResultNotice result={runtime.capture?.message} />
      <Button label="Take screenshot" disabled={runtime.capture?.active} onPress={() => perform(() => gamingNative.capture('screenshot'))} />
      <Button label={runtime.capture?.recording ? 'Stop recording' : 'Record screen'} variant="ghost" onPress={() => perform(() => runtime.capture?.recording ? gamingNative.stopCapture() : gamingNative.capture('record'))} />
      {runtime.capture?.active ? <Button label="Stop all capture" variant="ghost" onPress={() => perform(gamingNative.stopCapture)} /> : null}
      {captures.slice(0, 10).map((capture) => <View key={capture.id} style={{ borderTopWidth: 1, borderTopColor: theme.colors.border.base, paddingTop: 12, gap: 8 }}>
        <Type variant="caption">{capture.kind === 'video' ? 'Recording' : 'Screenshot'} • {new Date(capture.createdAt).toLocaleString()}</Type>
        <View style={{ flexDirection: 'row', gap: 8 }}><Button label="Open" variant="ghost" size="sm" onPress={() => perform(() => gamingNative.openCapture(capture.id))} /><Button label="Delete" variant="ghost" size="sm" onPress={() => Alert.alert('Delete capture?', 'Only this Optinix capture will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => perform(async () => { const result = await gamingNative.deleteCapture(capture.id); if (result.ok) setCaptures((items) => items.filter((item) => item.id !== capture.id)); return result }) }])} /></View>
      </View>)}
    </Card>
    <Card style={{ gap: 12 }}><Type variant="h2">Game utilities</Type>
      <Button label="Process Manager (Stop background apps)" variant="ghost" onPress={() => navigation.navigate('ProcessManager')} />
      <Button label="Startup Manager (Auto-start control)" variant="ghost" onPress={() => navigation.navigate('StartupManager')} />
      <Button label="Display & brightness" variant="ghost" onPress={() => perform(() => gamingNative.openSettings('display'))} />
      <Button label="Network Intelligence" variant="ghost" onPress={() => navigation.navigate('Network')} />
      <Button label="Macro Studio" variant="ghost" onPress={() => navigation.navigate('MacroStudio')} />
      {runtime.macro?.status === 'running' ? <><ResultNotice result={runtime.macro.message} /><Button label="Stop macro" onPress={() => perform(gamingNative.stopMacro)} /></> : null}
      <Button label="Session history" variant="ghost" onPress={() => navigation.navigate('Sessions')} />
      <Button label="Overlay appearance & shortcuts" variant="ghost" onPress={() => navigation.navigate('Main', { screen: 'Settings' })} />
    </Card>
    <Card style={{ gap: 12 }}><Type variant="h2">Automatic game recognition</Type>
      <ToggleRow title="Recognize games during a session" detail="Optional Usage Access identifies foreground games in your library while the user-started service is running. No monitoring when it is stopped." value={preferences.autoDetectGames} onChange={(autoDetectGames) => update({ autoDetectGames })} />
      <Button label={capabilities.usageAccess ? 'Usage access settings' : 'Allow usage access'} variant="ghost" onPress={() => perform(() => gamingNative.openSettings('usage'))} />
    </Card>
  </Screen>
}
