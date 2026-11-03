import React from 'react'
import { StyleSheet, View } from 'react-native'

import { describeExecution, summarizeDelta } from '../../lib/engineUi'
import { useTheme } from '../../theme/ThemeProvider'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card } from './Card'
import { Type } from './Type'
import { formatBytes, formatPercent, formatTemperature } from '../../lib/format'

const CAPABILITY = {
  apply: { label: 'ACTIVE', tone: 'accent' },
  monitor: { label: 'MONITOR', tone: 'neutral' },
  settings: { label: 'SETTINGS', tone: 'info' },
}

export function EngineCard({ engine, result, running, onRun, style }) {
  const theme = useTheme()
  const spec = CAPABILITY[engine.capability] ?? CAPABILITY.monitor
  const deltas = summarizeDelta(result?.delta)
  const message = describeExecution(result?.execution) ?? (result ? result.inspection == null ? 'No readable data is available for this scan.' : 'Scan complete. No system settings or other apps were changed.' : null)
  const inspection = result?.inspection

  return (
    <Card style={style}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Type variant="h3" style={{ flexShrink: 1 }}>
              {engine.name}
            </Type>
            <Badge label={spec.label} tone={spec.tone} />
          </View>
          <Type variant="caption" tone="tertiary" style={{ marginTop: 5 }}>
            {engine.description}
          </Type>
        </View>
        <Button
           label={running ? '...' : engine.capability === 'apply' ? 'Apply' : engine.capability === 'settings' ? 'Open' : 'Scan'}
          size="sm"
          variant="ghost"
          loading={running}
          onPress={onRun}
          style={{ marginLeft: theme.spacing[3] }}
        />
      </View>

      {result ? (
        <View style={{ marginTop: theme.spacing[3] }}>
          <Type
            variant="caption"
            tone={result.execution?.supported === false ? 'warn' : 'secondary'}
          >
            {message}
          </Type>
          {inspection && engine.id === 'memory-boost' ? <Type variant="caption" tone="secondary" style={{ marginTop: 8 }}>{formatBytes(inspection.availBytes)} available / {formatBytes(inspection.totalBytes)} total • {formatPercent(inspection.percent)} used</Type> : null}
          {inspection && engine.id === 'thermal-guard' ? <Type variant="caption" tone="secondary" style={{ marginTop: 8 }}>Thermal status: {inspection.status}. Battery: {formatTemperature(inspection.batteryCelsius)}.</Type> : null}
          {inspection && engine.id === 'storage-audit' ? <View style={{ marginTop: 10, gap: 8 }}><Type variant="caption">{formatBytes(inspection.storage?.freeBytes)} free storage</Type>{inspection.rankedApps?.map((app) => <Type key={app.packageName} variant="caption" tone="secondary">{app.label}: {formatBytes(app.totalBytes)}</Type>)}</View> : null}
          {inspection && engine.id === 'app-usage' ? <Type variant="caption" tone="secondary" style={{ marginTop: 8 }}>{inspection.usageAccess ? `${inspection.apps?.length ?? 0} visible recent apps reported.` : 'Optional Usage Access is needed to view recent app activity.'}</Type> : null}
          {deltas.length > 0 ? (
            <View style={styles.chips}>
              {deltas.map((delta) => (
                <Badge
                  key={delta.key}
                  label={`${delta.label} ${delta.text}`}
                  tone={delta.tone}
                  uppercase={false}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 8 },
})

export default EngineCard
