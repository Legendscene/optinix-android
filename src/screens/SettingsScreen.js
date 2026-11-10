import React, { useEffect, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from 'react-native'
import Constants from 'expo-constants'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Divider, Row } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Segmented } from '../components/ui/Segmented'
import { Type } from '../components/ui/Type'
import { ACCENT_OPTIONS, ACCENTS, DENSITY_OPTIONS, MODE_OPTIONS, DARK } from '../lib/designTokens'
import { formatDuration, relativeTime } from '../lib/format'
import { usePermissions } from '../hooks/usePermissions'
import { isAppsNativeAvailable } from '../native/apps'
import { isDeviceNativeAvailable } from '../native/device'
import { isOverlayNativeAvailable } from '../native/overlay'
import { useMonitor } from '../services/monitor'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import { ToggleRow } from '../components/ui/ToggleRow'
import { ResultNotice } from '../components/ui/ResultNotice'
import { Field } from '../components/ui/Field'
import gamingNative from '../native/gaming'
import { hudAccentHex, requestSessionNotifications } from '../services/gaming'
import { gameLibrary } from '../store/gameLibrary'
import { useCloudSyncState } from '../hooks/useCloudSyncState'
import adManager from '../services/adManager'
import { OptinixBannerAd } from '../components/ads/OptinixBannerAd'

const MOTION_OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'full', label: 'Full' },
  { id: 'reduced', label: 'Reduced' },
]

const INTERVAL_OPTIONS = [
  { id: 2000, label: '2s' },
  { id: 5000, label: '5s' },
  { id: 10000, label: '10s' },
  { id: 30000, label: '30s' },
]

const OPACITY_OPTIONS = [
  { id: 0.4, label: '40%' },
  { id: 0.7, label: '70%' },
  { id: 0.9, label: '90%' },
  { id: 1, label: '100%' },
]

export default function SettingsScreen({ navigation }) {
  const theme = useTheme()
  const { preferences, update, reset, saveError } = usePreferences()
  const [note, setNote] = useState(null)
  const [target, setTarget] = useState(preferences.networkTarget)
  const [handleSide, setHandleSide] = useState('left')
  useEffect(() => {
    let alive = true
    gamingNative.getHandleSide().then((state) => {
      if (alive && state?.portrait) setHandleSide(state.portrait)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  const permissions = usePermissions()
  const { metrics } = useMonitor()

  const isDark = preferences.mode === 'dark'

  return (
    <Screen>
      <SectionHeader eyebrow="PREFERENCES" title="Settings" />
      <ResultNotice result={note || saveError || permissions.error} />

      <Card>
        <Type variant="h3">Appearance</Type>

        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: theme.spacing[4], marginBottom: 8 }}>
          THEME
        </Type>
        <Segmented
          options={MODE_OPTIONS}
          value={preferences.mode}
          onChange={(mode) => update({ mode })}
        />

        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: theme.spacing[4], marginBottom: 8 }}>
          ACCENT
        </Type>
        <View style={styles.swatches}>
          {ACCENT_OPTIONS.map((option) => {
            const color = ACCENTS[option.id]?.[isDark ? 'dark' : 'light']?.accent
            const active = preferences.accent === option.id
            return (
              <Pressable
                key={option.id}
                onPress={() => update({ accent: option.id })}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                style={[
                  styles.swatch,
                  {
                    borderColor: active ? theme.colors.text.primary : theme.colors.border.base,
                    backgroundColor: color,
                  },
                ]}
              >
                {active ? <View style={styles.swatchDot} /> : null}
              </Pressable>
            )
          })}
        </View>

        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: theme.spacing[4], marginBottom: 8 }}>
          DENSITY
        </Type>
        <Segmented
          options={DENSITY_OPTIONS}
          value={preferences.density}
          onChange={(density) => update({ density })}
        />

        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: theme.spacing[4], marginBottom: 8 }}>
          MOTION
        </Type>
        <Segmented
          options={MOTION_OPTIONS}
          value={preferences.motion}
          onChange={(motion) => update({ motion })}
        />

        <Divider style={{ marginVertical: theme.spacing[3] }} />
        <Row
          title="Haptic feedback"
          subtitle="Short taps on buttons and tab changes"
          right={
            <Switch
              value={preferences.haptics}
              onValueChange={(haptics) => update({ haptics })}
              trackColor={{ false: theme.colors.bg[4], true: theme.accent.dim }}
              thumbColor={preferences.haptics ? theme.accent.color : theme.colors.text.tertiary}
            />
          }
        />
      </Card>

      <Card>
        <Type variant="h3">Monitoring</Type>
        <ToggleRow title="Battery-conscious mode" detail="At least 5 seconds between readings; pauses cinematic 3D. All monitoring pauses when Optinix is backgrounded unless you start a gaming session." value={preferences.batteryConscious} onChange={(batteryConscious) => update({ batteryConscious })} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
          How often the native snapshot is sampled while the app is open.
        </Type>
        <Segmented
          options={INTERVAL_OPTIONS}
          value={preferences.monitorIntervalMs}
          onChange={(monitorIntervalMs) => update({ monitorIntervalMs })}
          style={{ marginTop: theme.spacing[3] }}
        />
      </Card>

      <Card>
        <Type variant="h3">In-game HUD</Type>
        <Row
          title="HUD with game launches"
          subtitle="Use the HUD on launch when the game profile also enables it. Manual HUD controls are in Gaming tools."
          right={
            <Switch
              value={preferences.overlayEnabled}
              onValueChange={(overlayEnabled) => update({ overlayEnabled })}
              trackColor={{ false: theme.colors.bg[4], true: theme.accent.dim }}
              thumbColor={preferences.overlayEnabled ? theme.accent.color : theme.colors.text.tertiary}
            />
          }
        />
        <Type variant="label" style={{ marginTop: 18, marginBottom: 10 }}>Visibility over games</Type>
        <Segmented
          options={[
            { id: 'edge', label: 'Edge handle' },
            { id: 'notification', label: 'Notification' },
            { id: 'disabled', label: 'Disabled' },
          ]}
          value={preferences.overlayVisibility}
          onChange={async (overlayVisibility) => {
            await update({ overlayVisibility })
            if (overlayVisibility === 'notification' && !await requestSessionNotifications()) setNote('Session notifications are blocked. Enable Optinix notifications in Android Settings, or reopen the HUD from Gaming tools.')
            await permissions.refresh()
          }} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>
          {preferences.overlayVisibility === 'disabled'
            ? 'Completely disabled stops the gaming service, timer, tools and both HUD windows. Games still launch normally. Choose Edge handle or Notification to start a new session.'
            : preferences.overlayVisibility === 'notification'
              ? 'No floating handle or stats plate until you choose Show game HUD in the session notification. Minimize hides them again. Requires enabled notifications and overlay access.'
              : 'Only an 8–10 dp sliver stays visible; most of the handle is off-screen. Panels never expand automatically when a game starts.'}
        </Type>
        {permissions.overlayReason ? <ResultNotice result={permissions.overlayReason} /> : null}
        {preferences.overlayVisibility === 'notification' && permissions.notifications === false ? <Button label="Enable session notifications" variant="ghost" onPress={async () => setNote(await gamingNative.openSettings('notifications'))} /> : null}
        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: theme.spacing[3], marginBottom: 8 }}>
          Default handle opacity
        </Type>
        <Segmented
          options={OPACITY_OPTIONS}
          value={preferences.overlayOpacity}
          onChange={(overlayOpacity) => update({ overlayOpacity })}
        />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Handle transparency is adjustable. Panel text and controls keep their contrast.</Type>
        <Type variant="label" style={{ marginTop: 18, marginBottom: 10 }}>HUD accent</Type>
        <Row
          title="Follow app theme"
          subtitle="Off: choose a separate colour for the HUD below."
          right={
            <Switch
              value={preferences.overlayAccent === 'app'}
              onValueChange={(follow) => update({ overlayAccent: follow ? 'app' : preferences.accent })}
              trackColor={{ false: theme.colors.bg[4], true: theme.accent.dim }}
              thumbColor={preferences.overlayAccent === 'app' ? theme.accent.color : theme.colors.text.tertiary}
            />
          }
        />
        {preferences.overlayAccent !== 'app' ? (
          <View style={styles.hudSwatches}>
            {ACCENT_OPTIONS.map((option) => {
              const color = ACCENTS[option.id]?.dark?.accent
              const active = preferences.overlayAccent === option.id
              return (
                <Pressable
                  key={option.id}
                  onPress={() => update({ overlayAccent: option.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} HUD accent`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.swatch,
                    { borderColor: active ? theme.colors.text.primary : theme.colors.border.base, backgroundColor: color },
                  ]}
                >
                  {active ? <View style={styles.swatchDot} /> : null}
                </Pressable>
              )
            })}
          </View>
        ) : null}
        <View style={styles.hudPreviewHold}>
          <View style={styles.hudEdge}>
            <View style={[styles.hudNotch, { width: (preferences.overlaySize >= 72 ? 26 : preferences.overlaySize >= 64 ? 22 : 20) + 28, height: Math.max(88, Math.min(126, Math.floor(preferences.overlaySize * 1.75))), opacity: preferences.overlayOpacity }]}>
              <View style={[styles.hudDot, { backgroundColor: hudAccentHex(preferences, theme) }]} />
            </View>
          </View>
          <Type variant="caption" tone="tertiary" style={{ flex: 1 }}>
            Tap the handle to open the game assistant; swiping inward opens the same panel. Hold, then drag vertically or across the screen to dock on either edge.
          </Type>
        </View>
        <Type variant="label" style={{ marginTop: 18, marginBottom: 10 }}>Handle size</Type>
        <Segmented options={[48, 56, 64, 72].map((id) => ({ id, label: `${id}dp` }))} value={preferences.overlaySize} onChange={(overlaySize) => update({ overlaySize })} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Scales the handle grip (88–126&#8202;dp, phone-assistant height); the on-screen sliver is a capsule 20–26&#8202;dp wide streaked with the Optinix mark and keeps ~3/4 visibility when idle. Default 56&#8202;dp.</Type>
        <Type variant="label" style={{ marginTop: 18, marginBottom: 10 }}>Handle side</Type>
        <Segmented
          options={[{ id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }]}
          value={handleSide}
          onChange={(side) => {
            setHandleSide(side);
            gamingNative.setHandleSide(side).then((result) => setNote(result)).catch(() => {});
          }} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Which screen edge the collapsed handle parks on, applied to portrait and landscape together. Hold, then drag still re-docks it at any time. Default left.</Type>
        <Type variant="h3" style={{ marginTop: 20 }}>Idle behaviour</Type>
        <ToggleRow title="Fade handle when idle" detail="After 7 seconds without touch the collapsed handle dims to half opacity." value={preferences.overlayAutoHide !== false} onChange={(overlayAutoHide) => update({ overlayAutoHide })} />
        <Type variant="label" style={{ marginTop: 16, marginBottom: 10 }}>Auto-collapse</Type>
        <Segmented
          options={[
            { id: 'never', label: 'Never' },
            { id: '5', label: '5s' },
            { id: '10', label: '10s' },
            { id: '20', label: '20s' },
          ]}
          value={preferences.overlayAutoCollapse}
          onChange={(overlayAutoCollapse) => update({ overlayAutoCollapse })} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Idle panels minimize to the handle, or hide completely in Notification mode. Default 10&#8202;s.</Type>
        <Type variant="h3" style={{ marginTop: 20 }}>Shortcut dock</Type>
        <Type variant="caption" tone="tertiary" style={{ marginTop: 5 }}>Choose up to four. DND routes to permission settings when needed; capture always asks for consent.</Type>
        {[
          ['profile', 'Game profile'], ['dnd', 'Optinix DND'], ['timer', 'Timer'], ['network', 'Network test'],
          ['macro', 'Macro panel'], ['screenshot', 'Screenshot consent'], ['record', 'Recording consent'],
        ].map(([key, title]) => <ToggleRow key={key} title={title} value={preferences.overlayShortcuts.includes(key)} disabled={!preferences.overlayShortcuts.includes(key) && preferences.overlayShortcuts.length >= 4} onChange={(enabled) => update({ overlayShortcuts: enabled ? [...preferences.overlayShortcuts, key] : preferences.overlayShortcuts.filter((value) => value !== key) })} />)}
        <Button label="Reset overlay position" variant="ghost" onPress={async () => setNote(await gamingNative.resetPosition())} />
        <Button label="Open gaming control center" variant="ghost" onPress={() => navigation.navigate('GamingTools')} style={{ marginTop: 10 }} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Type variant="h3" style={{ flex: 1 }}>FPS stats HUD</Type>
          <Badge label={preferences.fpsHudEnabled ? 'ON' : 'OFF'} tone={preferences.fpsHudEnabled ? 'success' : 'neutral'} />
        </View>
        <Type variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
          A separate touch-through stats plate over library games. Notification mode hides it until you request the HUD; Disabled stops it with the gaming service.
        </Type>
        <ToggleRow
          title="Show stats HUD in sessions"
           detail="Uses the same measured session samples. Position, appearance and metrics are chosen here."
          value={preferences.fpsHudEnabled === true}
          onChange={(fpsHudEnabled) => update({ fpsHudEnabled })}
        />
        <Type variant="label" style={{ marginTop: 12, marginBottom: 8 }}>Mode</Type>
        <Segmented
          options={[
            { id: 'minimal', label: 'Minimal' },
            { id: 'compact', label: 'Compact' },
            { id: 'detailed', label: 'Detailed' },
          ]}
          value={preferences.fpsHudMode}
          onChange={(fpsHudMode) => update({ fpsHudMode })}
        />
        <Type variant="label" style={{ marginTop: 14, marginBottom: 8 }}>Corner</Type>
        <Segmented
          options={[
            { id: 'topLeft', label: 'Top left' },
            { id: 'topRight', label: 'Top right' },
            { id: 'bottomLeft', label: 'Bottom left' },
            { id: 'bottomRight', label: 'Bottom right' },
          ]}
          value={preferences.fpsHudCorner}
          onChange={(fpsHudCorner) => update({ fpsHudCorner })}
        />
        <Type variant="label" style={{ marginTop: 14, marginBottom: 8 }}>Size</Type>
        <Segmented
          options={[
            { id: 0.85, label: 'Small' },
            { id: 1, label: 'Normal' },
            { id: 1.2, label: 'Large' },
          ]}
          value={preferences.fpsHudScale}
          onChange={(fpsHudScale) => update({ fpsHudScale })}
        />
        <Type variant="eyebrow" tone="tertiary" style={{ marginTop: 14, marginBottom: 8 }}>
          OPACITY
        </Type>
        <Segmented options={OPACITY_OPTIONS} value={preferences.fpsHudOpacity} onChange={(fpsHudOpacity) => update({ fpsHudOpacity })} />
        {Number(Platform.Version) >= 31 ? <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Android 12+ caps effective window opacity at its touch-through limit (normally 80%) so gameplay underneath remains tappable. Android 10–11 use the requested opacity.</Type> : null}
        {preferences.fpsHudMode === 'detailed' ? (
          <>
            <Type variant="label" style={{ marginTop: 14, marginBottom: 8 }}>Visible metrics (detailed)</Type>
            {[
              ['cpu', 'CPU usage'], ['ram', 'RAM usage'], ['temp', 'Temperature'], ['battery', 'Battery'], ['refresh', 'Display refresh'],
            ].map(([key, title]) => (
              <ToggleRow
                key={key}
                title={title}
                value={(preferences.fpsHudMetrics ?? []).includes(key)}
                onChange={(enabled) => {
                  const current = preferences.fpsHudMetrics ?? []
                  update({ fpsHudMetrics: enabled ? [...current, key] : current.filter((value) => value !== key) })
                }}
              />
            ))}
          </>
        ) : (
          <Type variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
            Detailed mode adds chosen CPU, RAM, temperature, battery and display lines, plus an honest note about game FPS.
          </Type>
        )}
        <Type variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
           Game FPS and frame time show &quot;--&quot; on Android 10–16: Android does not expose another app&apos;s frames. Display Hz is separate. Unavailable CPU or sensor readings also show &quot;--&quot;.
        </Type>
      </Card>

      <Card style={{ gap: 14 }}>
        <Type variant="h3">Gaming preferences</Type>
        <ToggleRow title="Utility macros" detail="User-started, finite utility sequences. No cross-app touch input." value={preferences.macroEnabled} onChange={(macroEnabled) => update({ macroEnabled })} />
        <ToggleRow title="Recognize foreground games" detail="During explicitly started sessions only; requires optional Usage Access." value={preferences.autoDetectGames} onChange={(autoDetectGames) => update({ autoDetectGames })} />
        <ToggleRow title="Break reminder notifications" detail="Ask Android for notification permission when enabling." value={preferences.notifications} onChange={async (enabled) => { if (!enabled || await requestSessionNotifications()) update({ notifications: enabled }); else setNote('Notification permission denied. In-app controls still work.') }} />
        <Type variant="label">Manual session reminder interval</Type>
        <Segmented options={[0, 15, 30, 45, 60].map((id) => ({ id, label: id ? `${id}m` : 'Off' }))} value={preferences.reminderMinutes} onChange={(reminderMinutes) => update({ reminderMinutes })} />
        <Button label="Game profiles" variant="ghost" onPress={() => navigation.navigate('Games')} />
        <Button label="Macro Studio" variant="ghost" onPress={() => navigation.navigate('MacroStudio')} />
      </Card>

      <Card style={{ gap: 14 }}>
        <Type variant="h3">Network diagnostics</Type>
        <Field label="HTTPS target" value={target} onChangeText={setTarget} keyboardType="url" autoCapitalize="none" hint="Tests run only when requested. This endpoint is not automatically a game server." />
        <Button label="Save diagnostic target" variant="ghost" onPress={() => {
          if (!/^https:\/\/[^\s/@#]+(?:\/[^\s#]*)?$/.test(target) || target.length > 300) { setNote('Enter an HTTPS URL without credentials, spaces or fragments.'); return }
          update({ networkTarget: target }); setNote('Diagnostic target updated.')
        }} />
        <Button label="Open Network Intelligence" variant="ghost" onPress={() => navigation.navigate('Network')} />
      </Card>

      <Card style={{ gap: 14 }}>
        <Type variant="h3">Optinix Account</Type>
        <AccountSummary onOpen={(route) => navigation.navigate(route)} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Permissions</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              Android special-access screens, granted by you.
            </Type>
          </View>
          <Button label="Refresh" size="sm" variant="ghost" onPress={permissions.refresh} />
        </View>
        <Divider style={{ marginVertical: theme.spacing[2] }} />
        <Row
          title="Usage access"
          subtitle="Recently used apps and foreground detection"
          right={
            <Badge
               label={permissions.usageAccess ? 'GRANTED' : 'OPTIONAL'}
              tone={permissions.usageAccess ? 'success' : 'warn'}
            />
          }
          onPress={permissions.grantUsage}
        />
        <Divider />
        <Row
          title="Display over other apps"
          subtitle={permissions.overlayReason ?? 'Required for the edge handle and both HUD windows'}
          right={
            <Badge
              label={permissions.overlay ? 'GRANTED' : permissions.overlayRestricted ? 'RESTRICTED' : 'REQUIRED'}
              tone={permissions.overlay ? 'success' : 'warn'}
            />
          }
          onPress={permissions.grantOverlay}
        />
        <Divider />
        <Row
          title="Modify system settings"
          subtitle="Lets the in-game panel change brightness and lock rotation. Read-only metrics need no extra access."
          right={<Badge label="OPTIONAL" tone="neutral" />}
          onPress={async () => setNote(await gamingNative.openSettings('write'))}
        />
        <Divider />
        <Row
          title="Battery optimisation exemption"
           subtitle="Optional OEM troubleshooting for user-started sessions; does not bypass Android restrictions"
          right={
            <Badge
              label={permissions.batteryOptimizationExempt ? 'EXEMPT' : 'ASK'}
              tone={permissions.batteryOptimizationExempt ? 'success' : 'neutral'}
            />
          }
          onPress={permissions.grantBattery}
        />
        <View style={{ marginTop: theme.spacing[3] }}>
          <Button label="Run device check" variant="secondary" onPress={() => navigation.navigate('DeviceCheck')} />
        </View>
      </Card>

      <Card style={{ gap: 14 }}>
        <Type variant="h3">Privacy & local data</Type>
        <Type variant="bodySm" tone="secondary">Live telemetry, diagnostic history and captures stay on this device. If you sign in, account sync stores your settings, library, profiles and utility macros in your account. Network tests contact your chosen HTTPS target.</Type>
        <Type variant="label">Session & diagnostic retention</Type>
        <Segmented options={[7, 30, 90].map((id) => ({ id, label: `${id} days` }))} value={preferences.retentionDays} onChange={(retentionDays) => update({ retentionDays })} />
        <Button label="Session history" variant="ghost" onPress={() => navigation.navigate('Sessions')} />
        <Button label="Clear game library & profiles" variant="ghost" onPress={() => Alert.alert('Clear Game Space?', 'Games stay installed. Saved library entries, favorites and per-game profiles will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { try { await gameLibrary.reset(); setNote('Library cleared; automatic discovery is disabled.') } catch (e) { setNote(e.message) } } }])} />
      </Card>

      <Card>
        <Type variant="h3">Native modules</Type>
        <View style={{ marginTop: theme.spacing[2] }}>
          <Row
            title="OptinixDevice"
            subtitle="CPU, memory, storage, thermals, app FPS"
            right={
              <Badge
                label={isDeviceNativeAvailable ? 'LINKED' : 'MISSING'}
                tone={isDeviceNativeAvailable ? 'success' : 'danger'}
              />
            }
          />
          <Divider />
          <Row
            title="OptinixApps"
            subtitle="Installed apps, usage stats, cache"
            right={
              <Badge
                label={isAppsNativeAvailable ? 'LINKED' : 'MISSING'}
                tone={isAppsNativeAvailable ? 'success' : 'danger'}
              />
            }
          />
          <Divider />
          <Row
            title="OptinixOverlay"
            subtitle="Foreground service + system HUD"
            right={
              <Badge
                label={isOverlayNativeAvailable ? 'LINKED' : 'MISSING'}
                tone={isOverlayNativeAvailable ? 'success' : 'danger'}
              />
            }
          />
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Type variant="h3">Monetization & Ads</Type>
          <Badge label="TEST MODE" tone="neutral" />
        </View>
        <Type variant="bodySm" tone="secondary">
          Non-intrusive Google AdMob integration. Ads are strictly disabled while optimization tasks or gaming sessions are running.
        </Type>
        <Button
          label="Ad privacy & consent (GDPR / UMP)"
          variant="ghost"
          onPress={async () => {
            const res = await adManager.requestConsent()
            setNote(res.ok ? 'Privacy consent checked.' : (res.error ?? 'Consent check completed.'))
          }}
        />
        <Button
          label="Support Optinix (Watch rewarded ad)"
          variant="secondary"
          onPress={async () => {
            setNote('Loading rewarded ad...')
            const res = await adManager.showRewardedAd({
              onEarnedReward: () => {
                setNote('Thank you for supporting Optinix development!')
              },
              onError: (err) => {
                setNote(err?.message ?? 'Rewarded ad unavailable right now.')
              },
            })
            if (!res.ok && res.reason === 'optimizing') {
              setNote('Cannot show ads while optimization sweep is running.')
            } else if (!res.ok && res.reason === 'gaming_active') {
              setNote('Cannot show ads while gaming session is active.')
            }
          }}
        />
      </Card>

      <Card>
        <Type variant="h3">About</Type>
        <View style={{ marginTop: theme.spacing[2] }}>
          <Row dense title="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <Row dense title="Supported Android" value="10–16 (API 29–36)" />
          <Row dense title="Runtime" value={`SDK ${metrics?.device?.sdkInt ?? '--'}`} />
          <Row dense title="Release" value={metrics?.device?.release ?? '--'} />
          <Row dense title="Uptime" value={formatDuration(metrics?.uptimeMs)} />
        </View>
        <Button
          label="Reset preferences"
          variant="ghost"
           onPress={() => Alert.alert('Reset preferences?', 'Your games and macros are kept. Overlay appearance, diagnostics target and session preferences return to defaults.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', onPress: () => { reset(); setTarget('https://www.gstatic.com/generate_204') } }])}
          style={{ marginTop: theme.spacing[4] }}
        />
      </Card>

      <OptinixBannerAd style={{ marginTop: 16 }} />
    </Screen>
  )
}

/**
 * Account summary for the Settings entry card. State comes only from the
 * cloudSync engine — nothing is claimed that the engine does not know.
 */
function AccountSummary({ onOpen }) {
  const theme = useTheme()
  const sync = useCloudSyncState()
  const badge = !sync.configured
    ? { label: 'NOT CONFIGURED', tone: 'neutral' }
    : sync.userId
      ? { label: 'SIGNED IN', tone: 'success' }
      : { label: 'OPTIONAL', tone: 'neutral' }
  const statusLine = !sync.configured
    ? 'This build has no cloud credentials, so account features are unavailable. Everything else works normally.'
    : sync.userId
      ? (sync.status === 'conflict'
          ? 'Sync needs your choice: open the Account screen and pick which copy to keep.'
          : sync.status === 'offline'
            ? 'Sync is waiting to reach the cloud — it retries automatically and your settings stay local meanwhile.'
            : sync.lastSyncedAt
              ? 'Signed in. Theme, HUD, gaming settings and library sync with your account.'
              : 'Signed in. Run a first Sync now from the Account screen to start the sync handshake.')
      : 'Optional. Sign in to keep your settings in sync across your devices — or keep using Optinix without an account.'

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Type variant="bodySm" style={{ flex: 1, color: theme.colors.text.secondary }}>{statusLine}</Type>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      {sync.configured ? (
        <Button
          label={sync.userId ? 'Manage account & sync' : 'Sign in'}
          onPress={() => onOpen(sync.userId ? 'Account' : 'Auth')}
        />
      ) : null}
      {sync.lastSyncedAt ? (
        <Type variant="caption" tone="tertiary">{`Last synced ${relativeTime(sync.lastSyncedAt)}`}</Type>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', gap: 12 },
  swatch: {
     width: 48,
     height: 48,
     borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hudSwatches: { flexDirection: 'row', gap: 12, marginTop: 4 },
  // The in-game HUD is intentionally always dark, so the preview uses the
  // global DARK token set instead of the current (possibly light) theme.
  hudPreviewHold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: DARK.surface[1],
    borderWidth: 1,
    borderColor: DARK.border.base,
    marginTop: 4,
  },
  hudEdge: { width: 30, height: 78, overflow: 'hidden', justifyContent: 'center', borderRightWidth: 1, borderRightColor: DARK.border.light },
  hudNotch: {
    position: 'absolute',
    right: -16,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 7,
    borderWidth: 1,
    borderColor: DARK.border.light,
    justifyContent: 'center',
    backgroundColor: DARK.surface[2],
  },
  hudDot: { width: 3, height: 3, borderRadius: 2, marginLeft: 2 },
})
