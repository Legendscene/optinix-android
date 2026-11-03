import React, { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Field } from '../components/ui/Field'
import { ResultNotice } from '../components/ui/ResultNotice'
import { MACRO_ACTIONS, macroDuration, newMacro, previewMacro, validateMacro } from '../lib/macros'
import { macroStore, saveMacro } from '../store/macros'
import { useTheme } from '../theme/ThemeProvider'

export default function MacroEditorScreen({ route, navigation }) {
  const theme = useTheme()
  const [draft, setDraft] = useState(() => {
    const saved = macroStore.getState().data.macros.find((item) => item.id === route.params?.id)
    return saved ? { ...saved, steps: saved.steps.map((step) => ({ ...step })) } : newMacro()
  })
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)
  const errors = validateMacro(draft)
  const updateStep = (index, patch) => setDraft((previous) => ({ ...previous, steps: previous.steps.map((step, i) => i === index ? { ...step, ...patch } : step) }))
  const move = (index, direction) => setDraft((previous) => {
    const steps = [...previous.steps]
    const target = index + direction
    if (target < 0 || target >= steps.length) return previous
    ;[steps[index], steps[target]] = [steps[target], steps[index]]
    return { ...previous, steps }
  })
  const save = async () => {
    if (errors.length) { setNote(errors.join('\n')); return }
    setBusy(true)
    try { await saveMacro(draft); navigation.goBack() }
    catch (e) { setNote(e.message) }
    finally { setBusy(false) }
  }
  return <Screen bottomInset={40}>
    <PageHeader title={route.params?.id ? 'Edit macro' : 'Create macro'} subtitle="Utility actions only. Every sequence is validated before it can be saved or run." />
    <ResultNotice result={note} />
    <Card style={{ gap: 18 }}>
      <Field label="Macro name" value={draft.name} maxLength={60} onChangeText={(name) => setDraft({ ...draft, name })} />
      <Field label="Category" value={draft.category} maxLength={40} onChangeText={(category) => setDraft({ ...draft, category })} />
      <Field label="Repeat count" hint="1–20 repeats; scheduled duration at most 10 minutes." value={String(draft.repeats)} keyboardType="number-pad" onChangeText={(value) => setDraft({ ...draft, repeats: value === '' ? '' : Number(value) })} />
    </Card>
    {draft.steps.map((step, index) => <Card key={index} style={{ gap: 12 }}>
      <Type variant="h3">Step {index + 1}</Type>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MACRO_ACTIONS.map((action) => <Pressable key={action.id} accessibilityRole="radio" accessibilityState={{ checked: step.type === action.id }} onPress={() => updateStep(index, { type: action.id, durationMs: step.durationMs ?? 1000, label: step.label ?? 'Marker' })} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: step.type === action.id ? theme.accent.dim : theme.colors.bg[3] }}><Type variant="caption" tone={step.type === action.id ? 'accentInk' : 'secondary'}>{action.label}</Type></Pressable>)}
      </View>
      <Type variant="bodySm" tone="tertiary">{MACRO_ACTIONS.find((item) => item.id === step.type)?.detail ?? 'Unsupported action — choose an available utility action.'}</Type>
      {step.type === 'delay' ? <Field label={`Step ${index + 1} delay in milliseconds`} value={String(step.durationMs ?? '')} keyboardType="number-pad" onChangeText={(value) => updateStep(index, { durationMs: value === '' ? '' : Number(value) })} hint="100 to 60,000 ms" /> : null}
      {step.type === 'marker' ? <Field label={`Step ${index + 1} marker label`} value={step.label ?? ''} maxLength={80} onChangeText={(label) => updateStep(index, { label })} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Button label="Move up" size="sm" variant="ghost" disabled={index === 0} onPress={() => move(index, -1)} /><Button label="Move down" size="sm" variant="ghost" disabled={index === draft.steps.length - 1} onPress={() => move(index, 1)} /><Button label="Remove" size="sm" variant="ghost" onPress={() => setDraft({ ...draft, steps: draft.steps.filter((_, i) => i !== index) })} /></View>
    </Card>)}
    <Button label="Add step" variant="ghost" disabled={draft.steps.length >= 30} onPress={() => setDraft({ ...draft, steps: [...draft.steps, { type: 'delay', durationMs: 1000 }] })} />
    <Card style={{ gap: 10 }}><Type variant="h2">Sequence preview</Type>{previewMacro(draft).map((line, i) => <Type key={i} variant="bodySm">{line}</Type>)}<Type variant="caption" tone="secondary">{draft.repeats || '--'} repeats • {macroDuration(draft) == null ? '--' : `${(macroDuration(draft) / 1000).toFixed(1)}s`} scheduled runtime. Android scheduling can delay actual completion.</Type></Card>
    {errors.length ? <ResultNotice result={{ ok: false, message: errors.join('\n') }} /> : null}
    <Button label="Save macro" loading={busy} onPress={save} />
  </Screen>
}
