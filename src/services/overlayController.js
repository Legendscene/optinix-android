/**
 * overlayController.js — the only overlay JS surface Optinix uses: the
 * explicit stop path for the Dashboard quick action. Session lifecycle,
 * starting and configuration live in the native gaming surface
 * (OptinixOverlayModule via src/native/gaming.js) so there is one source of
 * truth and no duplicate start/config handles.
 */
import overlayNative from '../native/overlay'

export async function stopOverlay() {
  await overlayNative.stop()
}

export default { stopOverlay }
