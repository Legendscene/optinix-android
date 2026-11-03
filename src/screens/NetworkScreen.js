import React, { useCallback, useRef, useState } from 'react'
import { Alert, AppState, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Field } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { Sparkline } from '../components/ui/Sparkline'
import { ResultNotice } from '../components/ui/ResultNotice'
import { compareDiagnostics, milliseconds, validateTarget } from '../lib/networkDiagnostics'
import { networkHistory, pruneNetworkHistory, saveDiagnostic, useNetworkHistory } from '../store/networkHistory'
import { usePreferences } from '../theme/ThemeProvider'
import gamingNative from '../native/gaming'
import { useMonitor } from '../services/monitor'

export default function NetworkScreen() {
  const { preferences, update } = usePreferences()
  const { metrics } = useMonitor()
  const { data, error } = useNetworkHistory()
  const [target, setTarget] = useState(preferences.networkTarget)
  const [count, setCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [note, setNote] = useState(null)
  const alive = useRef(true)
  const running = useRef(false)
  useFocusEffect(useCallback(() => {
    alive.current = true
    pruneNetworkHistory(preferences.retentionDays).catch((e) => { if (alive.current) setNote(e.message) })
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active' && running.current) gamingNative.cancelDiagnostics() })
    return () => { alive.current = false; subscription.remove(); if (running.current) gamingNative.cancelDiagnostics() }
  }, [preferences.retentionDays]))
  const run = async () => {
    const invalid = validateTarget(target)
    if (invalid) { setNote(invalid); return }
    if (running.current) return
    running.current = true; setBusy(true); setNote(null)
    try {
      update({ networkTarget: target })
      const next = await gamingNative.diagnose({ target, samples: count, timeoutMs: 2500 })
      if (next.finishedAt) await saveDiagnostic(next, preferences.retentionDays)
      if (alive.current) { setResult(next); setNote(next.message) }
    } catch (e) { if (alive.current) setNote(e.message) }
    finally { running.current = false; if (alive.current) setBusy(false) }
  }
  const comparison = compareDiagnostics(baseline, result)
  return <Screen bottomInset={40}>
    <PageHeader title="Network Intelligence" subtitle="Measure the connection you actually have. Separate endpoint latency from game-server ping." />
    <Card accent style={{ gap: 12 }}>
      <Type variant="h2">{metrics?.networkType ?? result?.transport ?? 'Connection status pending'}</Type>
      <Type variant="bodySm" tone="secondary">{result ? `Last run: ${result.validated === true ? 'Android validated the connection' : result.validated === false ? 'Connection not validated' : 'Validation unavailable'}. ${result.metered ? 'Metered connection.' : 'Metered status: ' + (result.metered === false ? 'unmetered' : '--')}` : 'No background probes. Start a diagnostic to measure HTTPS response timing and system DNS resolution.'}</Type>
      <Field label="Diagnostic endpoint" value={target} onChangeText={setTarget} editable={!busy} autoCapitalize="none" keyboardType="url" placeholder="https://example.com/health" hint="Requests are sent to this endpoint only when you run a test." />
      <Segmented options={[3, 5, 10].map((id) => ({ id, label: `${id} samples` }))} value={count} onChange={(value) => { if (!busy) setCount(value) }} />
      <Button label={baseline ? 'Run & compare' : 'Run diagnostic'} loading={busy} onPress={run} />
      {busy ? <><Type variant="caption" tone="tertiary">Up to {count} HTTPS requests, 2.5 seconds per request. Failed probes remain missing values.</Type><Button label="Cancel diagnostic" variant="ghost" onPress={async () => setNote(await gamingNative.cancelDiagnostics())} /></> : null}
    </Card>
    <ResultNotice result={note || error} />
    {result?.samples ? <>
      <Card style={{ gap: 16 }}>
        <Type variant="h2">Endpoint response</Type><Type variant="monoXl" style={{ fontSize: 36 }}>{milliseconds(result.averageMs)}</Type>
        <Type variant="caption" tone="tertiary">HTTPS mean • includes connection/TLS/server overhead</Type>
        <Sparkline values={result.samples.map((sample) => sample.elapsedMs)} height={80} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}><View><Type variant="label">Jitter</Type><Type variant="mono">{milliseconds(result.jitterMs)}</Type></View><View><Type variant="label">Min / max</Type><Type variant="mono">{milliseconds(result.minMs)} / {milliseconds(result.maxMs)}</Type></View></View>
        <Type variant="bodySm">{result.successfulSamples ?? 0} successful of {result.attemptedSamples ?? 0} attempted</Type>
        <Type variant="bodySm">HTTP failure ratio: {typeof result.httpFailurePercent === 'number' ? `${result.httpFailurePercent.toFixed(1)}%` : '--'}</Type>
        <Type variant="bodySm" tone="tertiary">IP packet loss: --. HTTPS requests cannot measure lost network packets. Jitter is the mean absolute change between adjacent successful requests.</Type>
      </Card>
      <Card style={{ gap: 12 }}><Type variant="h2">DNS resolution</Type><Type variant="monoXl">{milliseconds(result.dnsMs)}</Type><Type variant="bodySm" tone="secondary">{result.dnsError ?? `${result.dnsAddressCount ?? '--'} address records returned by the system resolver. Cached responses may be faster.`}</Type></Card>
      <Card style={{ gap: 10 }}><Type variant="h2">Probe timeline</Type>{result.samples.map((sample, index) => <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Type variant="caption" tone="tertiary">{index + 1} • HTTP {sample.httpStatus ?? '--'}</Type><Type variant="caption" tone={sample.elapsedMs == null ? 'warn' : 'secondary'} style={{ flex: 1, textAlign: 'right' }}>{sample.elapsedMs == null ? sample.error : milliseconds(sample.elapsedMs)}</Type></View>)}</Card>
    </> : null}
    {baseline ? <Card style={{ gap: 12 }}><Type variant="h2">Observed comparison</Type><Type variant="caption" tone="tertiary">Baseline: {new Date(baseline.finishedAt).toLocaleString()}</Type><Type variant="bodySm">{comparison.comparable ? `Mean latency change: ${comparison.latencyDeltaMs > 0 ? '+' : ''}${comparison.latencyDeltaMs.toFixed(1)} ms` : comparison.reason}</Type><Type variant="caption" tone="tertiary">This compares measurements, not the cause of a change. Routing, DNS, VPN and proxy settings are never changed by Optinix.</Type><Button label="Clear baseline" variant="ghost" onPress={() => setBaseline(null)} /></Card> : null}
    <Card style={{ gap: 14 }}><Type variant="h2">Diagnostic history</Type>{data.runs.length === 0 ? <Type variant="bodySm" tone="tertiary">Your next test creates the first local history entry.</Type> : <Sparkline values={[...data.runs].reverse().map((entry) => entry.averageMs)} height={55} />}{data.runs.slice(0, 20).map((entry) => <View key={entry.id} style={{ gap: 6, paddingVertical: 8 }}><Type variant="bodySemi">{milliseconds(entry.averageMs)} • {entry.transport}</Type><Type variant="caption" tone="tertiary">{entry.target}</Type><Type variant="caption" tone="tertiary">{new Date(entry.finishedAt).toLocaleString()}{entry.cancelled ? ' • Cancelled' : ''}</Type><View style={{ flexDirection: 'row', gap: 8 }}><Button label="Details" size="sm" variant="ghost" onPress={() => setResult(entry)} /><Button label="Use as baseline" size="sm" variant="ghost" onPress={() => { setBaseline(entry); setTarget(entry.target) }} /></View></View>)}</Card>
    <Button label="Open Android network settings" variant="ghost" onPress={async () => setNote(await gamingNative.openSettings('network'))} />
    {data.runs.length ? <Button label="Clear diagnostic history" variant="ghost" onPress={() => Alert.alert('Clear diagnostics?', 'Only locally stored diagnostic results are removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { try { await networkHistory.reset(); setBaseline(null); setResult(null) } catch (e) { setNote(e.message) } } }])} /> : null}
  </Screen>
}
