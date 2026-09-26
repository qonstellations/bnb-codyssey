// Keyboard/pointer response capture. event.timeStamp is high-res and monotonic
// from navigation start, so RT = responseTimeStamp - stimulusOnsetTimeStamp.

export function waitForResponse(validKeys, timeoutMs) {
  return new Promise((resolve) => {
    let done = false
    const normalizedKeys = validKeys.map((k) => k.toLowerCase())

    function finish(result) {
      if (done) return
      done = true
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
      clearTimeout(timer)
      resolve(result)
    }

    function onKeyDown(event) {
      if (event.repeat) return
      const key = event.key.toLowerCase()
      if (!normalizedKeys.includes(key)) return
      finish({ key, time: event.timeStamp })
    }

    // Pointer response only counts when validKeys includes a synthetic 'click' key.
    function onPointerDown(event) {
      if (!normalizedKeys.includes('click')) return
      finish({ key: 'click', time: event.timeStamp })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)

    const timer = timeoutMs
      ? setTimeout(() => finish(null), timeoutMs)
      : null
  })
}
