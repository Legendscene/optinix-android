import React, { useCallback, useState } from 'react'
import { Alert, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Type } from '../components/ui/Type'
import { Button } from '../components/ui/Button'
import { ResultNotice } from '../components/ui/ResultNotice'
import { formatDuration, formatPercent, formatTemperature } from '../lib/format'
import gamingNative from '../native/gaming'

export default function SessionsScreen() {
  const [sessions, setSessions] = useState([])
  const [note, setNote] = useState(null)
  useFocusEffect(useCallback(() => { let alive = true; gamingNative.getSessions().then((data) => { if (alive) setSessions(Array.isArray(data) ? data : []) }); return () => { alive = false } }, []))
  return <Screen bottomInset={40}>
    <PageHeader title="Session history" subtitle="Measured during Optinix sessions. Session duration is not a claim of continuous gameplay." />
    <ResultNotice result={note} />
    {sessions.length === 0 ? <Card><Type variant="h3">Your next session starts the story</Type><Type variant="bodySm" tone="tertiary" style={{ marginTop: 8 }}>Launch a game or start the timer in Gaming tools. Finished sessions appear here; readings remain on-device.</Type></Card> : sessions.map((entry) => <Card key={entry.id} style={{ gap: 12 }}>
      <Type variant="h2">{entry.gameLabel || 'Gaming session'}</Type>
      <Type variant="caption" tone="tertiary">{new Date(entry.startedAt).toLocaleString()} • {entry.profileName ?? 'Balanced'}</Type>
      <Type variant="monoXl">{formatDuration(entry.durationMs)}</Type>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Type variant="caption">CPU avg {formatPercent(entry.cpuAverage)}</Type><Type variant="caption">RAM avg {formatPercent(entry.ramAverage)}</Type><Type variant="caption">Peak temp {formatTemperature(entry.tempPeak)}</Type></View>
      <Type variant="bodySm" tone={entry.interrupted ? 'warn' : 'secondary'}>{entry.interrupted ? 'Interrupted: duration ends at the last recorded checkpoint.' : `Ended: ${entry.reason ?? 'user stopped'}.`}</Type>
      <Type variant="caption" tone="tertiary">Temperature source: {entry.temperatureSource ?? 'unavailable'}. Game FPS unavailable.</Type>
    </Card>)}
    {sessions.length ? <Button label="Clear session history" variant="ghost" onPress={() => Alert.alert('Clear session history?', 'This removes locally stored session summaries.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { const result = await gamingNative.clearSessions(); if (result.ok) setSessions([]); setNote(result) } }])} /> : null}
  </Screen>
}
