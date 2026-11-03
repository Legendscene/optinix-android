import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export function createPersistentStore(key, initial, sanitize) {
  let state = { data: sanitize(initial), ready: false, error: null }
  let loading = null
  let writes = Promise.resolve()
  const listeners = new Set()
  const emit = (patch) => {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }
  const load = () => {
    if (!loading) loading = AsyncStorage.getItem(key).then((raw) => {
      emit({ data: sanitize(raw ? JSON.parse(raw) : initial), ready: true, error: null })
    }).catch(() => emit({ ready: true, error: 'Saved data could not be read. Check storage before saving changes.' }))
    return loading
  }
  const change = (mutator) => {
    const operation = writes.then(load).then(async () => {
      const next = sanitize(mutator(state.data))
      try {
        await AsyncStorage.setItem(key, JSON.stringify(next))
        emit({ data: next, error: null })
        return next
      } catch {
        const error = 'Changes could not be saved. Free some device storage and try again.'
        emit({ error })
        throw new Error(error)
      }
    })
    writes = operation.catch(() => {})
    return operation
  }
  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const getState = () => state
  function useStore() {
    const snapshot = useSyncExternalStore(subscribe, getState, getState)
    useEffect(() => { load() }, [])
    return snapshot
  }
  return { load, change, getState, subscribe, useStore, reset: () => change(() => initial) }
}
