import AsyncStorage from '@react-native-async-storage/async-storage'
import { createPersistentStore } from '../src/store/persistentStore'

describe('persistent transactions', () => {
  beforeEach(() => jest.clearAllMocks())
  it('serializes overlapping updates without losing edits', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    AsyncStorage.setItem.mockResolvedValue(undefined)
    const store = createPersistentStore('concurrent', { count: 0 }, (raw) => raw)
    await Promise.all([store.change((raw) => ({ count: raw.count + 1 })), store.change((raw) => ({ count: raw.count + 1 }))])
    expect(store.getState().data.count).toBe(2)
  })
  it('does not claim a failed write was saved, and permits a retry', async () => {
    AsyncStorage.getItem.mockResolvedValue(null)
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
    const store = createPersistentStore('failed', { count: 0 }, (raw) => raw)
    await expect(store.change(() => ({ count: 7 }))).rejects.toThrow('could not be saved')
    expect(store.getState().data.count).toBe(0)
    await store.change(() => ({ count: 8 }))
    expect(store.getState()).toMatchObject({ data: { count: 8 }, error: null })
  })
})
