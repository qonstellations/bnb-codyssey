import { useEffect, useState } from 'react'
import { getSession } from '../../api/results.js'

// ponytail: the results API has no per-condition aggregation endpoint, so this pulls full
// trial data per session (capped at MAX_SESSIONS) and aggregates client-side. Fine at
// classroom-project scale; a real per-condition rollup should move server-side if session
// counts grow.
const MAX_SESSIONS = 50

export function useConditionAggregates(expId, sessions) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Keyed on the eligible ids, not the array identity, so a refresh with no new
  // completed/included sessions doesn't refetch every session's trials.
  const eligibleKey = sessions
    .filter((s) => s.status === 'completed' && !s.excluded)
    .slice(0, MAX_SESSIONS)
    .map((s) => s._id)
    .join(',')

  useEffect(() => {
    if (!eligibleKey) {
      setData({})
      return
    }
    let cancelled = false
    setLoading(true)

    Promise.all(eligibleKey.split(',').map((sid) => getSession(expId, sid)))
      .then((results) => {
        if (cancelled) return
        // Per condition: every trial RT, and one accuracy % per participant.
        const byCondition = {}
        for (const { trials } of results) {
          const scored = {}
          for (const trial of trials) {
            const key = trial.condition || '(none)'
            byCondition[key] ??= { rts: [], accuracies: [] }
            if (typeof trial.rt === 'number') byCondition[key].rts.push(trial.rt)
            if (trial.correct !== null) {
              scored[key] ??= [0, 0]
              scored[key][0] += trial.correct ? 1 : 0
              scored[key][1] += 1
            }
          }
          for (const [key, [correct, total]] of Object.entries(scored)) {
            byCondition[key].accuracies.push((correct / total) * 100)
          }
        }
        setData(byCondition)
      })
      .catch(() => !cancelled && setData({}))
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [expId, eligibleKey])

  return { data, loading }
}
