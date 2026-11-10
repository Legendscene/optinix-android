import React, { useCallback, useState } from 'react'
import { Alert, Share, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Type } from '../components/ui/Type'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ResultNotice } from '../components/ui/ResultNotice'
import { formatDuration, formatPercent, formatTemperature } from '../lib/format'
import { sessionShareText } from '../lib/sessionReport'
import gamingNative from '../native/gaming'
import { OptinixBannerAd } from '../components/ads/OptinixBannerAd'

export default function SessionsScreen() {
  const [sessions, setSessions] = useState(null)
  const [note, setNote] = useState(null)
  const load = useCallback(async () => {
    const data = await gamingNative.getSessions()
    setSessions(Array.isArray(data) ? data : [])
  }, [])
  useFocusEffect(useCallback(() => { let alive = true; load().then(() => { if (!alive) return }); return () => { alive = false } }, [load]))
  return <Screen bottomInset={40}>
    <PageHeader title="Session history" subtitle="Measured during Optinix sessions. Session duration is not a claim of continuous gameplay." />
    <ResultNotice result={note} />
    {sessions == null ? (
      <Card><EmptyState glyph="◌" title="Checking history…" body="Reading stored session summaries from the gaming service." /></Card>
    ) : sessions.length === 0 ? (
      <Card><EmptyState glyph="◈" title="Your next session starts the story" body="Launch a game or start the timer in Gaming tools. Finished sessions appear here; readings remain on-device." /></Card>
    ) : sessions.map((entry) => <Card key={entry.id} style={{ gap: 12 }}>
      <Type variant="h2">{entry.gameLabel || 'Gaming session'}</Type>
      <Type variant="caption" tone="tertiary">{new Date(entry.startedAt).toLocaleString()} • {entry.profileName ?? 'Balanced'}</Type>
      <Type variant="monoXl">{formatDuration(entry.durationMs)}</Type>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Type variant="caption">CPU avg {formatPercent(entry.cpuAverage)}</Type><Type variant="caption">RAM avg {formatPercent(entry.ramAverage)}</Type><Type variant="caption">Peak temp {formatTemperature(entry.tempPeak)}</Type></View>
      <Type variant="bodySm" tone={entry.interrupted ? 'warn' : 'secondary'}>{entry.interrupted ? 'Interrupted: duration ends at the last recorded checkpoint.' : `Ended: ${entry.reason ?? 'user stopped'}.`}</Type>
      <Type variant="caption" tone="tertiary">Temperature source: {entry.temperatureSource ?? 'unavailable'}. Game FPS unavailable.</Type>
      <Button
        label="Share report"
        variant="ghost"
        size="sm"
        onPress={async () => {
          try {
            await Share.share({ message: sessionShareText(entry) })
          } catch (error) {
            setNote({ ok: false, message: error?.message ?? 'Android could not open the share sheet.' })
          }
        }}
      />
    </Card>)}
    {sessions != null && sessions.length ? <Button label="Clear session history" variant="ghost" onPress={() => Alert.alert('Clear session history?', 'This removes locally stored session summaries.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { const result = await gamingNative.clearSessions(); if (result.ok) setSessions([]); setNote(result) } }])} /> : null}
    <OptinixBannerAd style={{ marginTop: 12 }} />
  </Screen>
}
