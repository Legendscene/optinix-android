import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EngineCard } from '../components/ui/EngineCard'
import { PermissionRow } from '../components/ui/PermissionRow'
import { Row, Divider } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Type } from '../components/ui/Type'
import { getEngine } from '../engines'
import { useEngineRun } from '../hooks/useEngineRun'
import { usePermissions } from '../hooks/usePermissions'
import { signed } from '../lib/engineUi'
import { formatBytes, relativeTime } from '../lib/format'
import { loadRuns, summarizeRuns } from '../lib/runHistory'
import { usePreferences, useTheme } from '../theme/ThemeProvider'
import gamingNative from '../native/gaming'

const ENGINE_IDS = ['memory-boost', 'cache-clean', 'game-boost', 'battery-audit', 'thermal-guard', 'storage-audit', 'device-scan', 'app-usage', 'fps-monitor', 'network-diagnose']

export default function BoostScreen() {
  const theme = useTheme()
  const { preferences } = usePreferences()
  const permissions = usePermissions()
  const { run, runningId, results } = useEngineRun()
  const [runs, setRuns] = useState([])
  const [sweepNote, setSweepNote] = useState(null)

  useFocusEffect(
    useCallback(() => {
      loadRuns().then(setRuns)
    }, []),
  )

  useEffect(() => {
    loadRuns().then(setRuns)
  }, [results])

  const summary = summarizeRuns(runs)
  const busy = runningId != null

  const runSweep = async () => {
    setSweepNote('Measuring baseline...')
    const memory = await run('memory-boost')
    const cache = await run('cache-clean')
    const parts = []
    if (memory?.delta?.ramPercent != null) parts.push(`RAM ${signed(memory.delta.ramPercent)}%`)
    if (cache?.execution?.freedBytes != null) {
      parts.push(`${formatBytes(cache.execution.freedBytes)} cleared`)
    }
    if (memory?.execution?.killed != null) parts.push(`${memory.execution.killed} apps closed`)
    setSweepNote(parts.length > 0 ? parts.join(' · ') : 'Finished without a measurable change')
  }

  return (
    <Screen>
      <SectionHeader eyebrow="CONTROL DECK" title="Optimise device" />

      <Card accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Safe sweep</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
               Review memory, then clear only Optinix cache. No unrelated apps are force-stopped.
            </Type>
          </View>
          <Badge label={`${summary.total} RUNS`} tone="accent" />
        </View>
        <View style={styles.summaryGrid}>
          <SummaryStat label="APPLIED" value={summary.total ? String(summary.applied) : '--'} />
          <SummaryStat label="MEASURED" value={summary.total ? String(summary.measured) : '--'} />
          <SummaryStat label="LAST RUN" value={summary.lastRunAt ? relativeTime(summary.lastRunAt) : '--'} />
        </View>
        <Button
          label={busy ? 'Running...' : 'Run safe sweep'}
          onPress={runSweep}
          loading={busy && runningId !== 'game-boost' && runningId !== 'battery-audit'}
          disabled={busy}
          size="lg"
          style={{ marginTop: theme.spacing[4] }}
        />
        {sweepNote ? (
          <Type variant="caption" tone="secondary" style={{ marginTop: 10 }}>
            {sweepNote}
          </Type>
        ) : null}
      </Card>

      {!permissions.usageAccess ? (
        <Card>
          <PermissionRow
            title="Usage access"
             description="Optional access for recent foreground usage and supported app-storage reports. Not needed for cache cleaning or live device readings."
            granted={permissions.usageAccess}
            onGrant={permissions.grantUsage}
          />
        </Card>
      ) : null}

      <Card style={{ gap: 12 }}><Type variant="h3">Storage & battery controls</Type><Type variant="bodySm" tone="tertiary">Use Android’s storage manager to locate large files and unused content. Changes remain under your control.</Type><Button label="Open storage manager" variant="ghost" onPress={async () => { const result = await gamingNative.openSettings('storage'); setSweepNote(result.message) }} /><Button label="Battery saver settings" variant="ghost" onPress={async () => { const result = await gamingNative.openSettings('battery'); setSweepNote(result.message) }} /></Card>

      <View style={{ gap: theme.density.gap }}>
        {ENGINE_IDS.map((id) => {
          const engine = getEngine(id)
          if (!engine) return null
          return (
            <EngineCard
              key={id}
              engine={engine}
              result={results[id]}
              running={runningId === id}
              onRun={() =>
                run(id, {
                  startOverlay: preferences.overlayEnabled,
                  accent: theme.accent.color,
                })
              }
            />
          )
        })}
      </View>

      <Card padded={false}>
        <View style={{ padding: theme.density.cardPad, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Run history</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
               {summary.applied} completed · {summary.measured} with measured deltas
            </Type>
          </View>
          {summary.lastRunAt ? (
            <Badge label={relativeTime(summary.lastRunAt)} tone="neutral" uppercase={false} />
          ) : null}
        </View>
        {runs.length === 0 ? (
          <View style={{ padding: theme.density.cardPad, paddingTop: 0 }}>
            <Type variant="caption" tone="tertiary">
              No runs yet. Start with the safe sweep above.
            </Type>
          </View>
        ) : (
          runs.slice(0, 6).map((entry, index) => (
            <View key={`${entry.engineId}-${entry.finishedAt}-${index}`}>
              <Divider style={{ marginHorizontal: theme.density.cardPad }} />
              <Row
                dense
                title={entry.name ?? entry.engineId}
                subtitle={
                  entry.delta?.ramPercent != null
                    ? `RAM ${signed(entry.delta.ramPercent)}%`
                    : entry.ok
                       ? 'Completed'
                      : 'Not applied'
                }
                value={relativeTime(entry.finishedAt)}
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <Type variant="h3">How this stays honest</Type>
        <Type variant="caption" tone="tertiary" style={{ marginTop: 6 }}>
           Android owns process and thermal management. Optinix measures available memory,
           reports accessible sensors, and counts successfully deleted own-cache files. A change
           in free RAM or app frame rate is not evidence of improved game performance.
        </Type>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryStat: { flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderRadius: 8 },
})

function SummaryStat({ label, value }) {
  const theme = useTheme()
  return (
    <View style={[styles.summaryStat, { borderColor: theme.colors.border.base, backgroundColor: theme.colors.bg[2] }]}>
      <Type variant="eyebrow" tone="tertiary" style={{ fontSize: 8 }}>{label}</Type>
      <Type variant="mono" tone="accentInk" style={{ marginTop: 4 }} numberOfLines={1}>{value}</Type>
    </View>
  )
}
