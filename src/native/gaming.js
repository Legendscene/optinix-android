import NativeOverlay, { isAvailable } from '../../modules/optinix-overlay'

const unavailable = { ok: false, status: 'unsupported', message: 'This feature needs an updated Optinix Android build.' }

async function call(method, args = [], fallback = unavailable) {
  if (!NativeOverlay || typeof NativeOverlay[method] !== 'function') return fallback
  try {
    return await NativeOverlay[method](...args) ?? fallback
  } catch (error) {
    return { ...unavailable, status: 'failed', message: error?.message ?? 'Android could not complete this action.' }
  }
}

export default {
  isAvailable,
  getCapabilities: () => call('getCapabilities', [], {}),
  getRuntime: () => call('getRuntime', [], { running: false, session: null, macro: null, capture: null }),
  configure: (config) => call('configureGaming', [config]),
  startSession: (config) => call('startSession', [config]),
  endSession: () => call('endSession'),
  timer: (action) => call('timerAction', [action]),
  getSessions: () => call('getSessionHistory', [], []),
  clearSessions: () => call('clearSessionHistory'),
  setDnd: (enabled) => call('setDnd', [enabled]),
  openSettings: (target) => call('openGamingSettings', [target]),
  capture: (mode) => call('requestCapture', [mode]),
  stopCapture: () => call('stopCapture'),
  getCaptures: () => call('getCaptures', [], []),
  openCapture: (id) => call('openCapture', [id]),
  deleteCapture: (id) => call('deleteCapture', [id]),
  startMacro: (macro) => call('startMacro', [macro]),
  stopMacro: () => call('stopMacro'),
  // App-side hide/show switch for the control HUD (the overlay "hidden state").
  setOverlayVisible: (visible) => call('setOverlayVisible', [visible]),
  diagnose: (config) => call('diagnoseNetwork', [config]),
  cancelDiagnostics: () => call('cancelDiagnostics'),
  resetPosition: () => call('resetOverlayPosition'),
  // Handle side control (Settings → Handle side): Left/Right, both orientations.
  setHandleSide: (side) => call('setHandleSide', [side]),
  getHandleSide: () => call('getHandleSide', [], { portrait: 'left', landscape: 'left' }),
}
