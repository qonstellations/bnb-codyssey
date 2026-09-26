// Keyboard/pointer response capture. event.timeStamp is high-res and monotonic
// from navigation start, so RT = responseTimeStamp - stimulusOnsetTimeStamp.

/** Safari < 14 reports event.timeStamp as epoch ms while rAF/performance.now() are
 *  navigation-relative — subtracting them yields ~1.7e12 ms of "RT". Normalise it
 *  rather than silently storing garbage. */
function stamp(event) {
  const t = event.timeStamp
  return t > 1e12 && performance.timeOrigin ? t - performance.timeOrigin : t
}

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
      finish({ key, time: stamp(event) })
    }

    // Pointer response only counts when validKeys includes a synthetic 'click' key.
    function onPointerDown(event) {
      if (!normalizedKeys.includes('click')) return
      finish({ key: 'click', time: stamp(event) })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)

    const timer = timeoutMs
      ? setTimeout(() => finish(null), timeoutMs)
      : null
  })
}
