import { useCallback, useRef, useState } from 'react'

import { runEngine } from '../engines'
import { appendRun } from '../lib/runHistory'

export function useEngineRun() {
  const [runningId, setRunningId] = useState(null)
  const [results, setResults] = useState({})
  const busy = useRef(false)

  const run = useCallback(async (id, options = {}) => {
    if (busy.current) return null
    busy.current = true
    setRunningId(id)
    try {
      const result = await runEngine(id, options)
      setResults((prev) => ({ ...prev, [id]: result }))
      await appendRun({
        engineId: result.engineId,
        name: result.name,
        finishedAt: result.finishedAt,
        ok: result.ok,
        delta: result.delta,
      })
      return result
    } finally {
      busy.current = false
      setRunningId(null)
    }
  }, [])

  const reset = useCallback(() => setResults({}), [])

  return { run, runningId, results, reset }
}

export default useEngineRun
