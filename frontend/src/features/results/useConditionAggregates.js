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

  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      setData({})
      return
    }
    let cancelled = false
    setLoading(true)

    const eligible = sessions
      .filter((s) => s.status === 'completed' && !s.excluded)
      .slice(0, MAX_SESSIONS)

    Promise.all(eligible.map((s) => getSession(expId, s._id)))
      .then((results) => {
        if (cancelled) return
        const byCondition = {}
        for (const { trials } of results) {
          for (const trial of trials) {
            const key = trial.condition || '(none)'
            byCondition[key] ??= { rtSum: 0, rtCount: 0, correct: 0, scored: 0 }
            const bucket = byCondition[key]
            if (typeof trial.rt === 'number') {
              bucket.rtSum += trial.rt
              bucket.rtCount += 1
            }
            if (trial.correct !== null) {
              bucket.scored += 1
              if (trial.correct) bucket.correct += 1
            }
          }
        }
        const aggregated = Object.fromEntries(
          Object.entries(byCondition).map(([condition, b]) => [
            condition,
            {
              meanRt: b.rtCount ? b.rtSum / b.rtCount : null,
              accuracy: b.scored ? b.correct / b.scored : null,
            },
          ])
        )
        setData(aggregated)
      })
      .finally(() => !cancelled && setLoading(false))

    return () => {
      cancelled = true
    }
  }, [expId, sessions])

  return { data, loading }
}
