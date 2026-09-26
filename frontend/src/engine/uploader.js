import { uploadTrials, beacon } from '../api/run.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createUploader({ sessionId, maxRetries = 3, retryDelayMs = 1000 }) {
  let flushing = false

  async function flush(trials) {
    if (!trials.length || flushing) return
    flushing = true
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await uploadTrials(sessionId, trials)
          return
        } catch (err) {
          if (attempt === maxRetries) throw err
          await wait(retryDelayMs)
        }
      }
    } finally {
      flushing = false
    }
  }

  // Call once per session: sends whatever hasn't flushed yet on tab close/hide.
  function attachUnloadHandlers(getPendingTrials) {
    const handler = () => {
      const pending = getPendingTrials()
      if (pending.length) beacon(sessionId, { trials: pending, status: 'abandoned' })
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler()
    })
    window.addEventListener('pagehide', handler)
  }

  return { flush, attachUnloadHandlers }
}
