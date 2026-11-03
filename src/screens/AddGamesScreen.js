import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Field } from '../components/ui/Field'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Type } from '../components/ui/Type'
import { ResultNotice } from '../components/ui/ResultNotice'
import { GameIcon } from '../components/gaming/GameArtwork'
import appsNative from '../native/apps'
import { addGame, useGameLibrary } from '../store/gameLibrary'

export default function AddGamesScreen() {
  const { data } = useGameLibrary()
  const [apps, setApps] = useState([])
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    appsNative.getInstalledApps(true).then((list) => { if (alive) { setApps(list); setLoading(false) } })
    return () => { alive = false }
  }, [])
  const selected = new Set(data.games.map((game) => game.packageName))
  const filtered = useMemo(() => apps.filter((app) => `${app.label} ${app.packageName}`.toLowerCase().includes(search.toLowerCase())), [apps, search])
  return (
    <Screen scroll={false} contentStyle={{ padding: 0 }}>
      <FlatList data={filtered} keyExtractor={(app) => app.packageName} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" initialNumToRender={10}
        ListHeaderComponent={<View style={{ gap: 18, marginBottom: 12 }}><PageHeader title="Add a game" subtitle="Choose from visible launcher apps. Only your selections are saved in Game Space." /><Field label="Search installed apps" value={search} onChangeText={setSearch} placeholder="Name or package" /><ResultNotice result={note} /></View>}
        ListEmptyComponent={<Type variant="bodySm" tone="tertiary">{loading ? 'Reading launcher apps…' : 'No matching launcher apps are visible on this device.'}</Type>}
        renderItem={({ item }) => <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><GameIcon game={item} size={42} /><View style={{ flex: 1, gap: 5 }}><Type variant="h3">{item.label}</Type><Type variant="caption" tone="tertiary">{item.packageName}</Type></View><Button label={selected.has(item.packageName) ? 'Added' : 'Add'} size="sm" variant="ghost" disabled={selected.has(item.packageName)} onPress={async () => { try { await addGame(item); setNote(`${item.label} added.`) } catch (e) { setNote(e.message) } }} /></Card>}
      />
    </Screen>
  )
}
