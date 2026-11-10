import React, { useEffect, useMemo, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
import { useIsFocused, useNavigation } from '@react-navigation/native'

import { AlertBanner } from '../components/ui/AlertBanner'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { CountUp } from '../components/ui/CountUp'
import { PulseDot } from '../components/ui/PulseDot'
import { success as hapticSuccess } from '../lib/haptics'
import { MetricRing } from '../components/ui/MetricRing'
import { Row, Divider } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Sparkline } from '../components/ui/Sparkline'
import { StatTile } from '../components/ui/StatTile'
import { Type } from '../components/ui/Type'
import { OrbScene } from '../components/three/OrbScene'
import { useEngineRun } from '../hooks/useEngineRun'
import { engines as engineRegistry } from '../engines'
import { signed } from '../lib/engineUi'
import { formatBytes, formatPercent, formatTemperature, relativeTime } from '../lib/format'
import { getMonitorState, useMonitor } from '../services/monitor'
import { stopOverlay } from '../services/overlayController'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import { GameArtwork } from '../components/gaming/GameArtwork'
import { selectGames, useGameLibrary } from '../store/gameLibrary'
import { useGamingRuntime } from '../hooks/useGamingRuntime'
import { gamingConfig, launchGame } from '../services/gaming'

export default function DashboardScreen() {
  const theme = useTheme()
  const navigation = useNavigation()
  const { preferences, reducedMotion } = usePreferences()
  const { metrics, health, alerts, history, status, error, lastUpdatedAt } = useMonitor()
  const { run, runningId } = useEngineRun()
  const { runtime, capabilities } = useGamingRuntime()
  const overlayOn = runtime.showing === true
  const hudLabel = preferences.overlayVisibility === 'disabled' ? 'HUD DISABLED' : capabilities.overlayRestricted ? 'HUD RESTRICTED' : overlayOn ? 'HUD LIVE' : capabilities.overlay ? 'HUD READY' : 'HUD ACCESS NEEDED'
  const { data: library } = useGameLibrary()
  const featured = selectGames(library.games).find((game) => game.installed)
  const focused = useIsFocused()
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const [lastAction, setLastAction] = useState(null)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setAppActive(next === 'active'))
    return () => subscription.remove()
  }, [])

  const cpuSeries = useMemo(() => history.map((point) => point.cpu), [history])
  const ramSeries = useMemo(() => history.map((point) => point.ram), [history])

  const deviceLabel = metrics?.device?.model ?? 'Android device'
  const busy = runningId != null

  const quickBoost = async () => {
    const memory = await run('memory-boost')
    const cache = await run('cache-clean')
    const parts = []
    if (memory?.delta?.ramPercent != null) {
      parts.push(`RAM ${signed(memory.delta.ramPercent)}%`)
    }
    if (cache?.execution?.freedBytes != null) {
      parts.push(`${formatBytes(cache.execution.freedBytes)} cache cleared`)
    }
    setLastAction(parts.length > 0 ? parts.join(' · ') : 'Scan finished')
  }

  const toggleOverlay = async () => {
    if (overlayOn) {
      await stopOverlay()
      return
    }
    navigation.navigate('GamingTools')
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Type variant="eyebrow" tone="accent">
            CONTROL CENTER
          </Type>
          <Type variant="h1" style={{ marginTop: 5 }} numberOfLines={1}>
             Ready to play.
          </Type>
          <Type variant="caption" tone="tertiary" style={{ marginTop: 5 }} numberOfLines={1}>
            {deviceLabel} · your measured performance space
          </Type>
        </View>
        <View style={styles.statusBlock}>
          <Badge label={status === 'live' ? 'LIVE' : String(status).toUpperCase()} tone={status === 'live' ? 'success' : status === 'sampling' ? 'warn' : 'danger'} />
          <PulseDot
            active={status === 'live'}
            tone={status === 'live' ? 'success' : status === 'sampling' ? 'warn' : 'danger'}
            size={8}
          />
        </View>
      </View>

      <GameArtwork game={featured}>
        <Type variant="bodySm" tone="secondary">{featured ? `Continue with ${featured.profile.name}. Your setup stays with this game.` : 'Build your personal Game Space, set a profile and bring your session tools into the game.'}</Type>
        <Button label={featured ? 'Launch game' : 'Open Game Space'} onPress={async () => {
          if (!featured) { navigation.navigate('Games'); return }
          try { const result = await launchGame(featured, gamingConfig(preferences, theme, reducedMotion)); hapticSuccess(); setLastAction(result.message) } catch (error) { setLastAction(error.message) }
        }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button label="HUD & tools" variant="ghost" size="sm" onPress={() => navigation.navigate('GamingTools')} />
          <Button label="Macro Studio" variant="ghost" size="sm" onPress={() => navigation.navigate('MacroStudio')} />
          <Button label="Network" variant="ghost" size="sm" onPress={() => navigation.navigate('Network')} />
          <Button label="Device check" variant="ghost" size="sm" onPress={() => navigation.navigate('DeviceCheck')} />
        </View>
      </GameArtwork>

      <View style={styles.signalRow}>
        <Badge label={hudLabel} tone={overlayOn ? 'success' : 'neutral'} />
        <Badge label={appActive ? 'TELEMETRY ON' : 'PAUSED'} tone={appActive ? 'info' : 'neutral'} />
        <Type variant="caption" tone="tertiary" style={{ flex: 1 }} numberOfLines={1}>
          {preferences.overlayVisibility === 'disabled' ? 'Gaming service is stopped by your visibility preference.' : capabilities.overlayReason ?? (overlayOn ? 'Gaming tools are available above other apps.' : 'Start a session from Optinix to use tools over a library game.')}
        </Type>
      </View>

      {!capabilities.overlay || !capabilities.usageAccess ? (
        <Card style={{ gap: 6 }}>
          <Row
            title="Finish HUD setup"
            subtitle={capabilities.overlayReason ?? 'Two permissions keep the assistant panel and game detection working over your games.'}
            right={<Button label="Device check" size="sm" variant="secondary" onPress={() => navigation.navigate('DeviceCheck')} />}
            onPress={() => navigation.navigate('DeviceCheck')}
          />
        </Card>
      ) : null}

      <View style={styles.sectionIntro}><Type variant="h2">Device health</Type><Type variant="caption" tone="tertiary">Score is an estimate from available device readings.</Type></View>

      <View style={styles.hero}>
        {focused && appActive && !reducedMotion && !preferences.batteryConscious ? <OrbScene
          size={296}
          accent={theme.accent.color}
          health={health?.score ?? null}
          active={status === 'live'}
          reducedMotion={reducedMotion}
          style={styles.orb}
        /> : null}
        <MetricRing
          value={health?.score ?? null}
          size={172}
          stroke={9}
          gradientColors={[theme.accent.color, theme.colors.semantic.cyan, theme.colors.semantic.violet]}
        >
          <CountUp
            value={health?.score ?? null}
            variant="monoXl"
            tone={health?.score == null ? 'tertiary' : 'primary'}
            style={{ fontSize: 40 }}
          />
          <Type
            variant="eyebrow"
            tone={health?.grade === 'poor' ? 'danger' : health?.grade === 'fair' ? 'warn' : 'accent'}
            style={{ marginTop: 2, fontSize: 8.5 }}
          >
             {health?.grade ? `${health.grade} estimate` : 'awaiting data'}
          </Type>
        </MetricRing>
      </View>

      <View style={styles.tiles}>
        {[
          {
            label: 'APP FPS',
            value: metrics?.fps == null ? '--' : Math.round(metrics.fps),
            unit: metrics?.fps == null ? '' : '/s',
            hint: metrics?.refreshRate
              ? `Optinix's own render rate · ${Math.round(metrics.refreshRate)}Hz screen`
              : "Optinix's own render rate — not the game's FPS",
            tone: 'info',
            progress:
              metrics?.fps != null && metrics?.refreshRate
                ? (metrics.fps / metrics.refreshRate) * 100
                : null,
          },
          {
            label: 'CPU',
            hint: metrics?.cpuPercent == null ? 'Android restricts this reading' : 'Measured CPU utilization',
            value: metrics?.cpuPercent == null ? '--' : Math.round(metrics.cpuPercent),
            unit: metrics?.cpuPercent == null ? '' : '%',
            progress: metrics?.cpuPercent ?? null,
            tone: metrics?.cpuPercent > 85 ? 'danger' : metrics?.cpuPercent > 65 ? 'warn' : 'success',
          },
          {
            label: 'RAM',
            value: metrics?.ramPercent == null ? '--' : Math.round(metrics.ramPercent),
            unit: metrics?.ramPercent == null ? '' : '%',
            hint:
              metrics?.ramUsedBytes != null && metrics?.ramTotalBytes != null
                ? `${formatBytes(metrics.ramUsedBytes)} / ${formatBytes(metrics.ramTotalBytes)}`
                : undefined,
            progress: metrics?.ramPercent ?? null,
            tone: metrics?.ramPercent > 88 ? 'danger' : metrics?.ramPercent > 70 ? 'warn' : 'accent',
          },
          {
            label: 'TEMP',
            value: metrics?.temperatureC == null ? '--' : metrics.temperatureC.toFixed(1),
            unit: metrics?.temperatureC == null ? '' : '°C',
            hint: metrics?.temperatureSource ?? metrics?.thermalStatus ?? undefined,
            progress:
              metrics?.temperatureC == null
                ? null
                : Math.min(100, (metrics.temperatureC / 70) * 100),
            tone: metrics?.temperatureC > 52 ? 'danger' : metrics?.temperatureC > 44 ? 'warn' : 'success',
          },
        ].map((tile) => (
          <StatTile key={tile.label} {...tile} style={styles.tile} />
        ))}
      </View>

      {status === 'unavailable' || status === 'error' ? (
        <AlertBanner
          severity="warning"
          title="Live telemetry unavailable"
          detail={
            error ??
            'Build the dev client so the Optinix native modules are compiled into the APK.'
          }
        />
      ) : null}

      {alerts.slice(0, 2).map((alert) => (
        <AlertBanner
          key={alert.id}
          severity={alert.severity}
          title={alert.title}
          detail={alert.detail}
        />
      ))}

      <Card>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Performance pass</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
               {lastAction ?? 'Free memory and clear only Optinix-owned cache. Other apps stay untouched.'}
            </Type>
          </View>
          <Badge label={`${formatPercent(metrics?.ramPercent)} RAM`} tone="neutral" uppercase={false} />
        </View>
        <View style={styles.actionRow}>
          <Button
             label={busy ? 'Working...' : 'Clean up'}
            onPress={quickBoost}
            loading={busy}
            style={{ flex: 1 }}
          />
          <Button
             label={overlayOn ? 'Stop HUD' : 'HUD controls'}
            variant="ghost"
            onPress={toggleOverlay}
            style={{ flex: 1 }}
          />
        </View>
        {lastUpdatedAt ? (
          <Type variant="caption" tone="tertiary" style={{ marginTop: 10 }}>
            Last sample {relativeTime(lastUpdatedAt)}
            {getMonitorState().intervalMs ? ` · every ${Math.round(getMonitorState().intervalMs / 1000)}s` : ''}
          </Type>
        ) : null}
      </Card>

      <Card>
        <View style={styles.cardHead}>
          <Type variant="h3">Live trends</Type>
          <Badge label="LAST 90 SAMPLES" tone="neutral" />
        </View>
        <View style={{ marginTop: theme.spacing[3] }}>
          <View style={styles.trendRow}>
            <Type variant="caption" tone="secondary" style={{ width: 46 }}>
              CPU
            </Type>
            <View style={{ flex: 1 }}>
              <Sparkline values={cpuSeries} color={theme.colors.semantic.cyan} height={38} />
            </View>
            <Type variant="mono" style={{ width: 54, textAlign: 'right' }}>
              {formatPercent(metrics?.cpuPercent)}
            </Type>
          </View>
          <View style={styles.trendRow}>
            <Type variant="caption" tone="secondary" style={{ width: 46 }}>
              RAM
            </Type>
            <View style={{ flex: 1 }}>
              <Sparkline values={ramSeries} color={theme.accent.color} height={38} />
            </View>
            <Type variant="mono" style={{ width: 54, textAlign: 'right' }}>
              {formatPercent(metrics?.ramPercent)}
            </Type>
          </View>
        </View>
      </Card>

      <View>
        <SectionHeader eyebrow="SYSTEM" title="Where to go next" />
        <Card padded={false} style={{ marginTop: theme.spacing[3] }}>
          <Row
            title="Optimise"
             subtitle="Device audits, own cache and supported settings"
             value={`${engineRegistry.length} engines`}
            onPress={() => navigation.navigate('Boost')}
          />
          <Divider style={{ marginHorizontal: theme.density.cardPad }} />
          <Row
            title="Games"
            subtitle="Detected titles, per-game boost, in-game HUD"
            value="Game Space"
            onPress={() => navigation.navigate('Games')}
          />
          <Divider style={{ marginHorizontal: theme.density.cardPad }} />
          <Row
            title="Monitor"
            subtitle="CPU cores, thermal zones, storage, network"
            value={formatTemperature(metrics?.temperatureC)}
            onPress={() => navigation.navigate('Monitor')}
          />
        </Card>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6 },
  statusBlock: { alignItems: 'flex-end', gap: 6, paddingBottom: 3 },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  sectionIntro: { gap: 4 },
  hero: { height: 230, alignItems: 'center', justifyContent: 'center' },
  orb: { position: 'absolute', opacity: 0.9 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
})
