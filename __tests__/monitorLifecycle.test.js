import { AppState } from 'react-native'
import deviceNative from '../src/native/device'
import { getMonitorState, startMonitor, stopMonitor } from '../src/services/monitor'

let mockAppStateListener
jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: jest.fn((_, listener) => { mockAppStateListener = listener; return { remove: jest.fn() } }) } }))
jest.mock('../src/native/device', () => ({ __esModule: true, default: { isAvailable: true, getSnapshot: jest.fn(), measureFps: jest.fn() } }))

describe('monitor lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    AppState.currentState = 'active'
    deviceNative.getSnapshot.mockResolvedValue({ capturedAt: 12, cpu: { overall: null }, memory: { percent: 50 }, battery: {}, thermal: {}, storage: {} })
    deviceNative.measureFps.mockResolvedValue({ fps: 58 })
  })
  afterEach(() => { stopMonitor(); jest.useRealTimers() })
  it('starts one polling loop and stops native requests in the background', async () => {
    startMonitor({ intervalMs: 2000 })
    startMonitor({ intervalMs: 2000 })
    await jest.advanceTimersByTimeAsync(0)
    expect(deviceNative.getSnapshot).toHaveBeenCalledTimes(1)
    mockAppStateListener('background')
    await jest.advanceTimersByTimeAsync(15000)
    expect(deviceNative.getSnapshot).toHaveBeenCalledTimes(1)
    expect(getMonitorState().metrics.fps).toBeNull()
    mockAppStateListener('active')
    await jest.advanceTimersByTimeAsync(0)
    expect(deviceNative.getSnapshot).toHaveBeenCalledTimes(2)
  })
  it('ignores an in-flight reading after stop', async () => {
    let finish
    deviceNative.getSnapshot.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const previous = getMonitorState().lastUpdatedAt
    startMonitor()
    stopMonitor()
    finish({ capturedAt: 999, memory: { percent: 99 } })
    await jest.advanceTimersByTimeAsync(0)
    expect(getMonitorState().lastUpdatedAt).toBe(previous)
    expect(getMonitorState().status).toBe('idle')
  })
})
