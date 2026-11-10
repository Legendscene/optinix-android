/**
 * useCloudSyncState — React binding for the cloudSync service singleton
 * (useSyncExternalStore: the engine object identity changes only on a real
 * state transition, so subscriptions stay cheap and honest).
 */
import { useSyncExternalStore } from 'react'

import { getCloudSyncState, subscribeCloudSync } from '../services/cloudSync'

export function useCloudSyncState() {
  return useSyncExternalStore(subscribeCloudSync, getCloudSyncState, getCloudSyncState)
}

export default useCloudSyncState
