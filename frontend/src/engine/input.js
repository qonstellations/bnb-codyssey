// Keyboard/pointer response capture. event.timeStamp is high-res and monotonic
// from navigation start, so RT = responseTimeStamp - stimulusOnsetTimeStamp.

// Physical key → validKeys spelling. event.code survives non-Latin layouts and CapsLock
// (KeyF → 'f', Digit3 → '3', Space → ' '); event.key is the fallback for everything else.
export function keyCandidates({ key = '', code = '' }) {
  const out = [key.toLowerCase()]
  if (code === 'Space') out.push(' ')
  else if (/^Key[A-Z]$/.test(code)) out.push(code.slice(3).toLowerCase())
  else if (/^(Digit|Numpad)\d$/.test(code)) out.push(code.slice(-1))
  return out
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
      const key = keyCandidates(event).find((k) => normalizedKeys.includes(k))
      if (key === undefined) return
      event.preventDefault() // Space must not scroll or press a focused button
      if (event.repeat) return
      finish({ key, time: event.timeStamp })
    }

    // Touch response pad buttons carry data-key; a bare pointer press only counts
    // when validKeys includes the synthetic 'click' key.
    function onPointerDown(event) {
      const padKey = event.target.closest?.('[data-key]')?.dataset.key
      const key = padKey ?? 'click'
      if (!normalizedKeys.includes(key)) return
      event.preventDefault()
      finish({ key, time: event.timeStamp })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)

    const timer = timeoutMs
      ? setTimeout(() => finish(null), timeoutMs)
      : null
  })
}
