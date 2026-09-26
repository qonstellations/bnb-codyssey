import { API_URL } from '../shared/config.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// `uploadFn` is injected (pass api/run.js's uploadTrials once Phase 3 lands) so this
// module doesn't hard-depend on an in-progress teammate file.
export function createUploader({ sessionId, uploadFn, maxRetries = 3, retryDelayMs = 1000 }) {
  let flushing = false

  async function flush(trials) {
    if (!trials.length || flushing) return
    flushing = true
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          await uploadFn(sessionId, trials)
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

  function beacon(trials, status) {
    const url = `${API_URL}/api/v1/run/sessions/${sessionId}/beacon`
    const body = JSON.stringify({ trials, status })
    navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))
  }

  // Call once per session: sends whatever hasn't flushed yet on tab close/hide.
  function attachUnloadHandlers(getPendingTrials) {
    const handler = () => {
      const pending = getPendingTrials()
      if (pending.length) beacon(pending, 'abandoned')
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler()
    })
    window.addEventListener('pagehide', handler)
  }

  return { flush, beacon, attachUnloadHandlers }
}
