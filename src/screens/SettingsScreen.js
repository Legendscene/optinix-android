import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native'
import Constants from 'expo-constants'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Divider, Row } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Segmented } from '../components/ui/Segmented'
import { Type } from '../components/ui/Type'
import { ACCENT_OPTIONS, ACCENTS, DENSITY_OPTIONS, MODE_OPTIONS } from '../lib/designTokens'
import { formatDuration } from '../lib/format'
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
  const permissions = usePermissions()
  const { metrics } = useMonitor()

  const isDark = preferences.mode === 'dark'

  return (
    <Screen>
      <SectionHeader eyebrow="PREFERENCES" title="Settings" />
      <ResultNotice result={note || saveError} />

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
          <View style={[styles.hudNotch, { borderColor: hudAccentHex(preferences, theme) }]}>
            <View style={[styles.hudDot, { backgroundColor: hudAccentHex(preferences, theme) }]} />
            <View style={styles.hudLine} />
          </View>
          <Type variant="caption" tone="tertiary" style={{ flex: 1 }}>
            Preview of the edge notch. It sits flush on the game screen edge; tapping it opens the tools drawer.
          </Type>
        </View>
        <Type variant="label" style={{ marginTop: 18, marginBottom: 10 }}>Notch size</Type>
        <Segmented options={[48, 56, 64, 72].map((id) => ({ id, label: `${id}dp` }))} value={preferences.overlaySize} onChange={(overlaySize) => update({ overlaySize })} />
        <Type variant="caption" tone="tertiary" style={{ marginTop: 8 }}>Scales the edge notch height (44–64&#8202;dp on the game screen). Default 56&#8202;dp.</Type>
        <Type variant="h3" style={{ marginTop: 20 }}>Idle behaviour</Type>
        <ToggleRow title="Fade handle when idle" detail="After 7 seconds without touch the collapsed handle dims to half opacity." value={preferences.overlayAutoHide !== false} onChange={(overlayAutoHide) => update({ overlayAutoHide })} />
        <Type variant="h3" style={{ marginTop: 20 }}>Shortcut dock</Type>
        <Type variant="caption" tone="tertiary" style={{ marginTop: 5 }}>Choose up to four. Permission-dependent shortcuts appear only when available; capture always asks for consent.</Type>
        {[
          ['profile', 'Game profile'], ['dnd', 'Optinix DND'], ['timer', 'Timer'], ['network', 'Network test'],
          ['macro', 'Macro panel'], ['screenshot', 'Screenshot consent'], ['record', 'Recording consent'],
        ].map(([key, title]) => <ToggleRow key={key} title={title} value={preferences.overlayShortcuts.includes(key)} disabled={!preferences.overlayShortcuts.includes(key) && preferences.overlayShortcuts.length >= 4} onChange={(enabled) => update({ overlayShortcuts: enabled ? [...preferences.overlayShortcuts, key] : preferences.overlayShortcuts.filter((value) => value !== key) })} />)}
        <Button label="Reset overlay position" variant="ghost" onPress={async () => setNote(await gamingNative.resetPosition())} />
        <Button label="Open gaming control center" variant="ghost" onPress={() => navigation.navigate('GamingTools')} style={{ marginTop: 10 }} />
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
          subtitle="Required for the in-game bubble"
          right={
            <Badge
              label={permissions.overlay ? 'GRANTED' : 'REQUIRED'}
              tone={permissions.overlay ? 'success' : 'warn'}
            />
          }
          onPress={permissions.grantOverlay}
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
      </Card>

      <Card style={{ gap: 14 }}>
        <Type variant="h3">Privacy & local data</Type>
        <Type variant="bodySm" tone="secondary">Game selections, macros, profiles and diagnostic history stay on this device. No telemetry is uploaded. Network tests contact only the HTTPS target you choose. Captures use Android consent and remain in local media storage.</Type>
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

      <Card>
        <Type variant="h3">About</Type>
        <View style={{ marginTop: theme.spacing[2] }}>
          <Row dense title="App version" value={Constants.expoConfig?.version ?? '1.0.0'} />
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
    </Screen>
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
  hudPreviewHold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0d1016',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginTop: 4,
  },
  hudNotch: {
    width: 26,
    height: 78,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  hudDot: { width: 8, height: 8, borderRadius: 4 },
  hudLine: { width: 12, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
})
