import AsyncStorage from '@react-native-async-storage/async-storage'
import { newMacro } from '../src/lib/macros'
import { deleteMacro, duplicateMacro, macroStore, saveMacro } from '../src/store/macros'

it('creates, renames, duplicates, persists and deletes independent macros', async () => {
  await macroStore.reset()
  const original = newMacro()
  await saveMacro(original)
  await saveMacro({ ...original, name: 'Warm-up', category: 'Practice' })
  const saved = macroStore.getState().data.macros[0]
  const copyId = await duplicateMacro(saved)
  expect(copyId).not.toBe(original.id)
  expect(macroStore.getState().data.macros).toHaveLength(2)
  const raw = JSON.parse(await AsyncStorage.getItem('optinix:macros:v1'))
  expect(raw.macros[0]).toMatchObject({ name: 'Warm-up', category: 'Practice' })
  await deleteMacro(original.id)
  expect(macroStore.getState().data.macros.map((macro) => macro.id)).toEqual([copyId])
})
