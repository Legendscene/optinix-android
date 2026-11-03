import React, { useMemo } from 'react'
import { View } from 'react-native'

import { Badge } from '../components/ui/Badge'
import { Bar, CoreBars } from '../components/ui/Bar'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Divider, Row } from '../components/ui/Row'
import { Screen } from '../components/ui/Screen'
import { SectionHeader } from '../components/ui/SectionHeader'
import { Type } from '../components/ui/Type'
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRate,
  formatTemperature,
  relativeTime,
} from '../lib/format'
import { sampleNow, useMonitor } from '../services/monitor'
import { useTheme } from '../theme/ThemeProvider'

export default function MonitorScreen() {
  const theme = useTheme()
  const { metrics, status, lastUpdatedAt, error } = useMonitor()

  const zones = useMemo(() => {
    const list = Array.isArray(metrics?.thermalZones) ? metrics.thermalZones : []
    return [...list].sort((a, b) => (b.celsius ?? 0) - (a.celsius ?? 0)).slice(0, 6)
  }, [metrics])

  const batteryCurrent =
    metrics?.batteryCurrentUa == null ? null : metrics.batteryCurrentUa / 1000

  return (
    <Screen>
      <SectionHeader
        eyebrow="LIVE TELEMETRY"
        title="Monitor"
        action={
          <Button
            label="Refresh"
            size="sm"
            variant="ghost"
            onPress={() => sampleNow(true)}
          />
        }
      />

      {status === 'unavailable' || status === 'error' ? (
        <Card accent>
          <Type variant="h3">Native module missing</Type>
          <Type variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
            {error ??
              'This build has no OptinixDevice binary. Run `npx expo run:android` or an EAS dev build so the Kotlin modules are compiled.'}
          </Type>
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">CPU</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              {metrics?.device?.cores ? `${metrics.device.cores} cores` : 'core count unavailable'}
              {metrics?.refreshRate ? ` · ${Math.round(metrics.refreshRate)}Hz display` : ''}
            </Type>
          </View>
          <Badge
            label={formatPercent(metrics?.cpuPercent)}
            tone={
              metrics?.cpuPercent > 85 ? 'danger' : metrics?.cpuPercent > 65 ? 'warn' : 'success'
            }
            uppercase={false}
          />
        </View>
        <CoreBars cores={metrics?.cpuPerCore ?? []} style={{ marginTop: theme.spacing[4] }} />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Memory</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              {metrics?.ramUsedBytes != null && metrics?.ramTotalBytes != null
                ? `${formatBytes(metrics.ramUsedBytes)} used of ${formatBytes(metrics.ramTotalBytes)}`
                : 'awaiting sample'}
            </Type>
          </View>
          <Badge label={formatPercent(metrics?.ramPercent)} tone="accent" uppercase={false} />
        </View>
        <Bar
          value={metrics?.ramPercent}
          tone={metrics?.ramPercent > 88 ? 'danger' : metrics?.ramPercent > 70 ? 'warn' : 'accent'}
          height={8}
          style={{ marginTop: theme.spacing[3] }}
        />
        <View style={{ marginTop: theme.spacing[3] }}>
          <Row dense title="Free" value={formatBytes(metrics?.ramAvailableBytes)} />
          <Row dense title="Used" value={formatBytes(metrics?.ramUsedBytes)} />
          <Row dense title="Total" value={formatBytes(metrics?.ramTotalBytes)} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Storage</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              {metrics?.storageFreeBytes != null
                ? `${formatBytes(metrics.storageFreeBytes)} free`
                : 'awaiting sample'}
            </Type>
          </View>
          <Badge
            label={formatPercent(metrics?.storagePercent)}
            tone={metrics?.storagePercent > 90 ? 'danger' : metrics?.storagePercent > 75 ? 'warn' : 'success'}
            uppercase={false}
          />
        </View>
        <Bar
          value={metrics?.storagePercent}
          tone={metrics?.storagePercent > 90 ? 'danger' : metrics?.storagePercent > 75 ? 'warn' : 'success'}
          height={8}
          style={{ marginTop: theme.spacing[3] }}
        />
        <View style={{ marginTop: theme.spacing[3] }}>
          <Row dense title="Used" value={formatBytes(metrics?.storageUsedBytes)} />
          <Row dense title="Total" value={formatBytes(metrics?.storageTotalBytes)} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Thermal</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              {metrics?.thermalStatus ? `Android thermal status: ${metrics.thermalStatus}` : 'no thermal API reading'}
            </Type>
          </View>
          <Badge
            label={formatTemperature(metrics?.temperatureC)}
            tone={metrics?.temperatureC > 52 ? 'danger' : metrics?.temperatureC > 44 ? 'warn' : 'success'}
            uppercase={false}
          />
        </View>
        <View style={{ marginTop: theme.spacing[3] }}>
          <Row dense title="Battery sensor" value={formatTemperature(metrics?.batteryTemperatureC)} />
          {zones.map((zone) => (
            <Row
              key={`${zone.name}-${zone.celsius}`}
              dense
              title={zone.name}
              value={formatTemperature(zone.celsius)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Battery</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              {metrics?.batteryStatus
                ? `${metrics.batteryStatus.replace('_', ' ')}`
                : 'no battery broadcast received'}
            </Type>
          </View>
          <Badge
            label={formatPercent(metrics?.batteryPercent)}
            tone={
              metrics?.batteryPercent == null
                ? 'neutral'
                : metrics.batteryPercent < 20
                  ? 'danger'
                  : metrics.batteryPercent < 40
                    ? 'warn'
                    : 'success'
            }
            uppercase={false}
          />
        </View>
        <View style={{ marginTop: theme.spacing[3] }}>
          <Row dense title="Temperature" value={formatTemperature(metrics?.batteryTemperatureC)} />
          <Row dense title="Current" value={batteryCurrent == null ? '--' : `${batteryCurrent.toFixed(0)} mA`} />
          <Row dense title="Uptime" value={formatDuration(metrics?.uptimeMs)} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Type variant="h3">Network</Type>
            <Type variant="caption" tone="tertiary" style={{ marginTop: 3 }}>
              Android connection information. Run a diagnostic for latency and jitter.
            </Type>
          </View>
          <Badge
            label={(metrics?.networkType ?? 'unknown').toUpperCase()}
            tone={metrics?.networkValidated === false ? 'warn' : 'info'}
          />
        </View>
        <View style={{ marginTop: theme.spacing[3] }}>
          <Row dense title="Latency" value={metrics?.pingMs == null ? '--' : `${metrics.pingMs.toFixed(1)} ms`} />
          <Row
            dense
            title="Jitter"
            value={metrics?.pingJitterMs == null ? '--' : `${metrics.pingJitterMs.toFixed(1)} ms`}
          />
          <Row dense title="OS bandwidth estimate" value={formatRate(metrics?.networkDownKbps)} />
          <Row
            dense
            title="Wi-Fi signal"
            value={metrics?.networkRssi == null ? '--' : `${metrics.networkRssi} dBm`}
          />
          <Row
            dense
            title="Metered"
            value={metrics?.networkMetered == null ? '--' : metrics.networkMetered ? 'Yes' : 'No'}
          />
        </View>
        {metrics?.networkValidated === false ? (
          <Type variant="caption" tone="warn" style={{ marginTop: 8 }}>
            Android reports this network as not validated — internet probes may fail.
          </Type>
        ) : null}
      </Card>

      <Card padded={false}>
        <View style={{ padding: theme.density.cardPad }}>
          <Type variant="h3">Device</Type>
        </View>
        <Divider style={{ marginHorizontal: theme.density.cardPad }} />
        <View style={{ paddingHorizontal: theme.density.cardPad, paddingVertical: 6 }}>
          <Row dense title="Model" value={metrics?.device?.model ?? '--'} />
          <Row dense title="Manufacturer" value={metrics?.device?.manufacturer ?? '--'} />
          <Row dense title="Android" value={metrics?.device?.release ?? '--'} />
          <Row dense title="SDK" value={metrics?.device?.sdkInt ?? '--'} />
          <Row dense title="ABI" value={metrics?.device?.abis?.[0] ?? '--'} />
          <Row dense title="Refresh rate" value={metrics?.refreshRate == null ? '--' : `${Math.round(metrics.refreshRate)} Hz`} />
          <Row dense title="Last sample" value={relativeTime(lastUpdatedAt)} />
        </View>
      </Card>
    </Screen>
  )
}
