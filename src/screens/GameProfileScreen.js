import React, { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { ToggleRow } from '../components/ui/ToggleRow'
import { Segmented } from '../components/ui/Segmented'
import { ResultNotice } from '../components/ui/ResultNotice'
import { GameArtwork } from '../components/gaming/GameArtwork'
import { PROFILE_PRESETS, profilePreview, sanitizeProfile } from '../lib/gameProfiles'
import { removeGame, updateGame, useGameLibrary } from '../store/gameLibrary'
import appsNative from '../native/apps'
import gamingNative from '../native/gaming'
import { useTheme } from '../theme/ThemeProvider'

export default function GameProfileScreen({ route, navigation }) {
  const theme = useTheme()
  const { data } = useGameLibrary()
  const game = data.games.find((item) => item.packageName === route.params?.packageName)
  const [draft, setDraft] = useState(() => sanitizeProfile(game?.profile))
  const [note, setNote] = useState(null)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!game) return
    setSaving(true)
    try { await updateGame(game.packageName, { profile: draft }); setNote('Profile saved. It will apply the next time you launch this game from Optinix.') }
    catch (e) { setNote({ ok: false, message: e.message }) }
    finally { setSaving(false) }
  }
  return (
    <Screen bottomInset={40}>
      <PageHeader title="Game profile" subtitle={game?.packageName ?? 'Game no longer in library'} />
      <GameArtwork game={game}><Type variant="bodySm" tone="secondary">Profiles configure Optinix session tools. Game performance modes and graphics remain controlled by the game or phone.</Type></GameArtwork>
      <ResultNotice result={note} />
      {PROFILE_PRESETS.map((preset) => <Pressable key={preset.id} accessibilityRole="radio" accessibilityState={{ checked: draft.id === preset.id }} onPress={() => setDraft(sanitizeProfile(preset))}><Card accent={draft.id === preset.id}><Type variant="h3" tone={draft.id === preset.id ? 'accentInk' : 'primary'}>{preset.name}</Type><Type variant="bodySm" tone="tertiary" style={{ marginTop: 7 }}>{preset.detail}</Type></Card></Pressable>)}
      <Card style={{ gap: 12 }}>
        <Type variant="h2">Session settings</Type>
        <ToggleRow title="Floating HUD" detail="Requires display-over-apps access; launching still works if denied." value={draft.overlay} onChange={(overlay) => setDraft({ ...draft, overlay })} />
        <ToggleRow title="Optinix DND rule" detail="Only our rule is enabled for the session. Other DND preferences are preserved." value={draft.dnd} onChange={(dnd) => setDraft({ ...draft, dnd })} />
        <Type variant="label">HUD sampling interval</Type>
        <Segmented options={[2000, 5000, 10000].map((id) => ({ id, label: `${id / 1000}s` }))} value={draft.intervalMs} onChange={(intervalMs) => setDraft({ ...draft, intervalMs })} />
        <Type variant="label">Break reminder</Type>
        <Segmented options={[0, 15, 30, 45, 60].map((id) => ({ id, label: id ? `${id}m` : 'Off' }))} value={draft.reminderMinutes} onChange={(reminderMinutes) => setDraft({ ...draft, reminderMinutes })} />
      </Card>
      <Card style={{ gap: 16 }}><Type variant="h2">What this profile does</Type>{profilePreview(draft).map((row) => <View key={row.key} style={{ gap: 4 }}><Type variant="bodySemi">{row.label}</Type><Type variant="bodySm" tone="secondary">{row.value}</Type><Type variant="caption" tone={row.status === 'app-owned' ? 'accentInk' : 'warn'}>{row.status === 'permission' ? 'Requires special access if enabled' : row.status === 'user-action' ? 'Requires user action in game / system settings' : 'Applied to Optinix when session starts'}</Type></View>)}</Card>
      <Button label="Save profile" loading={saving} disabled={!game} onPress={save} />
      <Button label="Game app settings" variant="ghost" disabled={!game?.installed} onPress={async () => setNote(await appsNative.openAppInfo(game.packageName) ? 'Game settings opened.' : 'Game settings are unavailable.')} />
      <Button label="Display & refresh-rate settings" variant="ghost" onPress={async () => setNote(await gamingNative.openSettings('display'))} />
      <Button label="Remove from library" variant="ghost" disabled={!game} onPress={() => Alert.alert('Remove from Game Space?', 'The game stays installed. Its Optinix library entry and profile will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await removeGame(game.packageName); navigation.goBack() } catch (e) { setNote(e.message) } } }])} />
      <View style={{ height: theme.spacing[2] }} />
    </Screen>
  )
}
