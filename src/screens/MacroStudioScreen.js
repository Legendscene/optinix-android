import React, { useState } from 'react'
import { Alert, View } from 'react-native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Field } from '../components/ui/Field'
import { ToggleRow } from '../components/ui/ToggleRow'
import { ResultNotice } from '../components/ui/ResultNotice'
import { macroDuration, validateMacro } from '../lib/macros'
import { deleteMacro, duplicateMacro, useMacros } from '../store/macros'
import gamingNative from '../native/gaming'
import { useGamingRuntime } from '../hooks/useGamingRuntime'
import { gamingConfig, requestSessionNotifications } from '../services/gaming'
import { usePreferences, useTheme } from '../theme/ThemeProvider'

export default function MacroStudioScreen({ navigation }) {
  const theme = useTheme()
  const { preferences, update, reducedMotion } = usePreferences()
  const { data, error } = useMacros()
  const { runtime, refresh } = useGamingRuntime()
  const [query, setQuery] = useState('')
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const run = async (macro) => {
    const errors = validateMacro(macro)
    if (errors.length) { setNote(errors.join('\n')); return }
    setBusy(true)
    try {
      const config = gamingConfig(preferences, theme, reducedMotion)
      await gamingNative.configure({ ...config, macros: data.macros })
      if (!runtime.running) {
        if (preferences.notifications) await requestSessionNotifications()
        const started = await gamingNative.startSession({ ...config, showOverlay: false })
        if (!started.ok) { setNote(started); return }
      }
      setNote(await gamingNative.startMacro(macro))
      await refresh()
    } catch (e) { setNote(e.message) }
    finally { setBusy(false) }
  }
  return <Screen bottomInset={40}>
    <PageHeader title="Macro Studio" subtitle="Build a repeatable utility sequence. Keep control of every step." action={<Button label="Create" onPress={() => navigation.navigate('MacroEditor')} />} />
    <Card accent style={{ gap: 12 }}>
      <Type variant="h2">Utility automation, made explicit</Type>
      <Type variant="bodySm" tone="secondary">Sequence waits, haptic cues, session markers, timer controls and HUD collapse. These actions control Optinix. This build cannot tap, swipe, aim or type inside another app and has no accessibility service.</Type>
      <ToggleRow title="Enable utility macros" detail="Runs only when you press Start. Maximum 20 repeats and 10 minutes. Screen lock or session Stop cancels execution." value={preferences.macroEnabled} onChange={(macroEnabled) => update({ macroEnabled })} />
    </Card>
    <ResultNotice result={note || error} />
    {runtime.macro?.status && runtime.macro.status !== 'idle' ? <Card style={{ gap: 12 }}><Type variant="h3">{runtime.macro.status}</Type><Type variant="bodySm">{runtime.macro.message}</Type><Type variant="caption" tone="tertiary">Completed steps: {runtime.macro.completedSteps}</Type>{runtime.macro.status === 'running' ? <Button label="Stop macro" onPress={async () => { setNote(await gamingNative.stopMacro()); await refresh() }} /> : null}</Card> : null}
    {runtime.running ? <Button label="End session & stop all tools" variant="ghost" onPress={async () => { setNote(await gamingNative.endSession()); await refresh() }} /> : null}
    <Field label="Find a macro or category" placeholder="Search your sequences" value={query} onChangeText={setQuery} />
    {data.macros.length === 0 ? <Card><Type variant="h2">A little routine, less repetition.</Type><Type variant="bodySm" tone="tertiary" style={{ marginTop: 8 }}>Create your first sequence. Add a warm-up marker, wait, then a haptic cue. Nothing runs until you start it.</Type></Card> : null}
    {data.macros.filter((macro) => `${macro.name} ${macro.category}`.toLowerCase().includes(query.toLowerCase())).map((macro) => <Card key={macro.id} style={{ gap: 12 }}>
      <Type variant="label" tone="accentInk">{macro.category}</Type><Type variant="h2">{macro.name}</Type>
      <Type variant="bodySm" tone="secondary">{macro.steps.length} steps • {macro.repeats} repeat{macro.repeats === 1 ? '' : 's'} • {macroDuration(macro) == null ? 'Invalid timing' : `${(macroDuration(macro) / 1000).toFixed(1)}s scheduled`}</Type>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button label="Start" accessibilityLabel={`Start ${macro.name}`} size="sm" disabled={!preferences.macroEnabled || runtime.macro?.status === 'running'} loading={busy} onPress={() => run(macro)} />
        <Button label="Edit" accessibilityLabel={`Edit ${macro.name}`} size="sm" variant="ghost" onPress={() => navigation.navigate('MacroEditor', { id: macro.id })} />
        <Button label="Duplicate" size="sm" variant="ghost" onPress={async () => { try { const id = await duplicateMacro(macro); navigation.navigate('MacroEditor', { id }) } catch (e) { setNote(e.message) } }} />
        <Button label="Delete" size="sm" variant="ghost" onPress={() => Alert.alert(`Delete ${macro.name}?`, 'This removes only the saved configuration. A running macro is stopped first.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await gamingNative.stopMacro(); try { await deleteMacro(macro.id) } catch (e) { setNote(e.message) } } }])} />
      </View>
    </Card>)}
  </Screen>
}
