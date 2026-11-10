/**
 * haptics.js — safe haptic feedback wrappers.
 *
 * All calls go through one guard: a missing/unavailable native module or a
 * system-level rejection must never crash a user flow, so every wrapper
 * swallows any failure and returns quietly. Callers in screens import the
 * named functions; jest mocks expo-haptics already (jest.setup.js).
 */
import * as Haptics from 'expo-haptics'

let unreachable = false

function run(promiseFactory) {
  if (unreachable) return
  Promise.resolve()
    .then(promiseFactory)
    .catch(() => {
      // Haptics silently unsupported on some devices/ROMs — memory is a
      // best-effort flag so we stop re-attempting after the first failure.
      unreachable = true
    })
}

/** Light impact tick — step changes, selections, successful actions. */
export function tap() {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
}

/** Soft selection tick — pickers, segmented changes, toggles. */
export function select() {
  run(() => Haptics.selectionAsync())
}

/** Success triple (green-style) — finished flow that changed real state. */
export function success() {
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
}

export default { tap, select, success }
