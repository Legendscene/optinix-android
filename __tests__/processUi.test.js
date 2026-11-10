import { filterApps, lastUsedLabel, screenTimeLabel, sortApps, summarizeMemory, SORT_OPTIONS, CATEGORY_OPTIONS } from '../src/lib/processUi'

const sample = [
  { packageName: 'com.gameinsight.airport', label: 'Airport City', lastTimeUsed: 2_000, totalTimeInForegroundMs: 65_000 },
  { packageName: 'com.example.notes', label: 'Notes', lastTimeUsed: null, totalTimeInForegroundMs: null },
  { packageName: 'com.other.game', label: 'Block Puzzle', lastTimeUsed: 1_000, totalTimeInForegroundMs: 300_000 },
]

const categorySample = [
  { packageName: 'com.gameinsight.airport', label: 'Airport City', isGame: true, isSystem: false, lastTimeUsed: 2_000, totalTimeInForegroundMs: 65_000 },
  { packageName: 'com.example.notes', label: 'Notes', isGame: false, isSystem: false, lastTimeUsed: null, totalTimeInForegroundMs: null },
  { packageName: 'com.other.game', label: 'Block Puzzle', isGame: true, isSystem: false, lastTimeUsed: 1_000, totalTimeInForegroundMs: 300_000 },
  { packageName: 'com.android.settings', label: 'Settings', isGame: false, isSystem: true, lastTimeUsed: 500, totalTimeInForegroundMs: 50_000 },
]

describe('processUi', () => {
  test('filterApps matches label and package, case-insensitively', () => {
    expect(filterApps(sample, 'airport')).toHaveLength(1)
    expect(filterApps(sample, 'BLOCK')).toHaveLength(1)
    expect(filterApps(sample, '  ')).toHaveLength(3)
    expect(filterApps(null, 'x')).toEqual([])
    expect(filterApps(sample, '')).toHaveLength(3)
  })

  test('filterApps filters by category', () => {
    expect(filterApps(categorySample, '', 'games')).toHaveLength(2)
    expect(filterApps(categorySample, '', 'user')).toHaveLength(3)
    expect(filterApps(categorySample, '', 'system')).toHaveLength(1)
    expect(filterApps(categorySample, 'notes', 'games')).toHaveLength(0)
  })

  test('CATEGORY_OPTIONS stay declared ids', () => {
    expect(CATEGORY_OPTIONS.map((c) => c.id)).toEqual(['all', 'user', 'games', 'system'])
  })

  test('sortApps recent puts missing timestamps last, newest first', () => {
    const ordered = sortApps(sample, 'recent')
    expect(ordered.map((app) => app.packageName)).toEqual([
      'com.gameinsight.airport',
      'com.other.game',
      'com.example.notes',
    ])
  })

  test('sortApps name is alphabetical and foreground is by screen time', () => {
    expect(sortApps(sample, 'name').map((app) => app.label)).toEqual(['Airport City', 'Block Puzzle', 'Notes'])
    expect(sortApps(sample, 'foreground')[0].packageName).toBe('com.other.game')
    expect(sortApps('nonsense')).toEqual([])
    expect(sortApps(null)).toEqual([])
  })

  test('SORT_OPTIONS stay declared ids', () => {
    expect(SORT_OPTIONS.map((option) => option.id)).toEqual(['recent', 'name', 'foreground'])
  })

  test('lastUsedLabel and screenTimeLabel stay honest for missing values', () => {
    expect(lastUsedLabel(sample[1])).toBe('Usage time not recorded')
    expect(screenTimeLabel(sample[1])).toBe(null)
    expect(screenTimeLabel(sample[2])).toBe('5m')
    expect(screenTimeLabel({ totalTimeInForegroundMs: 3_700_000 })).toBe('1h 2m')
  })

  test('summarizeMemory accepts normalized metrics and raw snapshots', () => {
    expect(summarizeMemory({ ramPercent: 41.5, ramUsedBytes: 1024, ramTotalBytes: 2048 })).toEqual({
      usedPercent: 41.5,
      usedBytes: 1024,
      totalBytes: 2048,
    })
    expect(summarizeMemory({ memory: { percent: 7, usedBytes: 10, totalBytes: 20 } })).toEqual({
      usedPercent: 7,
      usedBytes: 10,
      totalBytes: 20,
    })
    expect(summarizeMemory(null)).toEqual({ usedPercent: null, usedBytes: null, totalBytes: null })
  })
})
