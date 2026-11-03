import overlayNative from '../native/overlay'

let shown = false

export async function startOverlay(config = {}) {
  const allowed = await overlayNative.hasPermission()
  if (!allowed) return { ok: false, reason: 'permission' }

  const ok = await overlayNative.start(config)
  shown = Boolean(ok)
  return { ok: shown, reason: shown ? null : 'start-failed' }
}

export async function stopOverlay() {
  shown = false
  await overlayNative.stop()
}

export async function getOverlayState() {
  const state = await overlayNative.getState()
  shown = Boolean(state?.showing)
  return state
}

export function isOverlayShown() {
  return shown
}

export async function setOverlayConfig(config = {}) {
  return overlayNative.setConfig(config)
}

export default {
  startOverlay,
  stopOverlay,
  getOverlayState,
  isOverlayShown,
  setOverlayConfig,
}
