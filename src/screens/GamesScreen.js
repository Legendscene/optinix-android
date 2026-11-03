import React, { useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Type } from '../components/ui/Type'
import { Screen } from '../components/ui/Screen'
import { PageHeader } from '../components/ui/PageHeader'
import { Field } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { ResultNotice } from '../components/ui/ResultNotice'
import { GameArtwork, GameIcon } from '../components/gaming/GameArtwork'
import { discoverGames, gameLibrary, selectGames, updateGame, useGameLibrary } from '../store/gameLibrary'
import { gamingConfig, launchGame } from '../services/gaming'
import { usePreferences, useTheme } from '../theme/ThemeProvider'

export default function GamesScreen({ navigation }) {
  const theme = useTheme()
  const { preferences, reducedMotion } = usePreferences()
  const { data, ready, error } = useGameLibrary()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const columns = useWindowDimensions().width >= 600 ? 3 : 2
  const games = useMemo(() => selectGames(data.games, { search, filter, sort }), [data.games, search, filter, sort])
  const featured = selectGames(data.games).find((game) => game.installed)

  useFocusEffect(useCallback(() => {
    let alive = true
    gameLibrary.load().then(() => {
      if (gameLibrary.getState().data.discoveryEnabled) discoverGames().catch((e) => { if (alive) setNote({ ok: false, message: e.message }) })
    })
    return () => { alive = false }
  }, []))

  const discover = async () => {
    setBusy(true)
    try { await discoverGames(); setNote('Library refreshed using launchable apps on this device.') }
    catch (e) { setNote({ ok: false, message: e.message }) }
    finally { setBusy(false) }
  }
  const launch = async (game) => {
    setBusy(true)
    try { setNote(await launchGame(game, gamingConfig(preferences, theme, reducedMotion))) }
    catch (e) { setNote({ ok: false, message: e.message }) }
    finally { setBusy(false) }
  }
  const favorite = async (game) => {
    try { await updateGame(game.packageName, { favorite: !game.favorite }) }
    catch (e) { setNote({ ok: false, message: e.message }) }
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <FlatList
        key={columns} data={games} numColumns={columns} keyExtractor={(item) => item.packageName}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 160, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        initialNumToRender={8} windowSize={5}
        ListHeaderComponent={
          <View style={{ gap: 20, paddingBottom: 12 }}>
            <PageHeader back={false} title="Game Space" subtitle="Your games. Your setup. Ready when you are." action={<Button label="Add game" variant="ghost" size="sm" onPress={() => navigation.navigate('AddGames')} />} />
            <GameArtwork game={featured}>
              <Type variant="bodySm" tone="secondary">{featured ? `${featured.profile.name}. Configure once, launch with your supported session controls.` : 'Discover installed games or add a title manually. Your library stays on this device.'}</Type>
              <Button label={featured ? 'Launch game' : 'Discover games'} loading={busy} onPress={() => featured ? launch(featured) : discover()} />
              {featured ? <Button label="Configure profile" variant="ghost" onPress={() => navigation.navigate('GameProfile', { packageName: featured.packageName })} /> : null}
            </GameArtwork>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[['GamingTools', 'HUD & tools'], ['MacroStudio', 'Macro Studio'], ['Network', 'Network'], ['Sessions', 'Sessions']].map(([route, label]) => <Button key={route} label={label} size="sm" variant="secondary" onPress={() => navigation.navigate(route)} />)}
            </View>
            <ResultNotice result={note || error} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Type variant="h2">Library <Type variant="caption" tone="tertiary">{data.games.length}</Type></Type>
              <Button label="Refresh" variant="ghost" size="sm" loading={busy} onPress={discover} />
            </View>
            <Field label="Search library" placeholder="Game name or package" value={search} onChangeText={setSearch} />
            <Segmented options={[{ id: 'all', label: 'All' }, { id: 'favorites', label: 'Favorites' }, { id: 'installed', label: 'Installed' }]} value={filter} onChange={setFilter} />
            <Segmented options={[{ id: 'recent', label: 'Recently launched' }, { id: 'name', label: 'Name A–Z' }]} value={sort} onChange={setSort} />
            {!data.discoveryEnabled ? <Type variant="caption" tone="tertiary">Discovery queries apps with launcher icons, then identifies likely games. Nothing is uploaded. You choose which extra apps to add.</Type> : null}
          </View>
        }
        ListEmptyComponent={<Card><Type variant="h3">{!ready ? 'Loading library…' : search || filter !== 'all' ? 'No matching games' : 'Your first game belongs here'}</Type><Type variant="bodySm" tone="tertiary" style={{ marginTop: 8 }}>Use Discover games or Add game. Titles without a game category can be added manually.</Type></Card>}
        renderItem={({ item }) => (
          <Card style={{ flex: 1, maxWidth: `${100 / columns}%`, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <GameIcon game={item} size={46} />
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.favorite ? 'Unfavorite' : 'Favorite'} ${item.label}`} accessibilityState={{ selected: item.favorite }} onPress={() => favorite(item)} style={{ minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}><Type style={{ fontSize: 26 }} tone={item.favorite ? 'accent' : 'tertiary'}>{item.favorite ? '★' : '☆'}</Type></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Configure ${item.label}`} onPress={() => navigation.navigate('GameProfile', { packageName: item.packageName })} style={{ minHeight: 72, gap: 5 }}>
              <Type variant="h3" numberOfLines={2}>{item.label}</Type>
              <Type variant="caption" tone="tertiary" numberOfLines={1}>{item.profile.name}</Type>
              <Type variant="caption" tone={item.installed ? 'secondary' : 'warn'}>{item.installed ? 'Installed' : 'Unavailable'}</Type>
            </Pressable>
            <Button label="Play" accessibilityLabel={`Play ${item.label}`} disabled={busy || !item.installed} onPress={() => launch(item)} />
          </Card>
        )}
      />
    </Screen>
  )
}
