function detectBrowser(ua) {
  const match =
    ua.match(/(Firefox|Edg|Chrome|Safari)\/(\d+)/) ||
    ua.match(/(OPR)\/(\d+)/)
  if (!match) return 'Unknown'
  const name = { Edg: 'Edge', OPR: 'Opera' }[match[1]] ?? match[1]
  return `${name} ${match[2]}`
}

function detectOS(ua) {
  if (/Windows NT/.test(ua)) return 'Windows'
  if (/Mac OS X/.test(ua)) return 'macOS'
  if (/Android/.test(ua)) return 'Android'
  if (/iPhone|iPad/.test(ua)) return 'iOS'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Unknown'
}

export function getDeviceInfo() {
  return {
    browser: detectBrowser(navigator.userAgent),
    os: detectOS(navigator.userAgent),
    screenW: window.screen.width,
    screenH: window.screen.height,
    pixelRatio: window.devicePixelRatio || 1,
  }
}

function stdDev(values, mean) {
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// Records ~sampleFrames of rAF deltas to estimate refresh rate, jitter and dropped frames.
export function runCalibration(sampleFrames = 120) {
  return new Promise((resolve) => {
    const deltas = []
    let last = null
    let count = 0

    function tick(now) {
      if (last !== null) {
        deltas.push(now - last)
        count++
      }
      last = now
      if (count < sampleFrames) {
        requestAnimationFrame(tick)
      } else {
        finish()
      }
    }

    function finish() {
      const meanFrameTime = deltas.reduce((a, b) => a + b, 0) / deltas.length
      const jitter = stdDev(deltas, meanFrameTime)
      const refreshRate = Math.round(1000 / meanFrameTime)
      const expected = 1000 / refreshRate
      const droppedFrames = deltas.filter((d) => d > expected * 1.5).length

      // Heuristic 0-100: penalize jitter (ms) and dropped-frame rate.
      const jitterPenalty = Math.min(jitter * 10, 60)
      const dropPenalty = Math.min((droppedFrames / deltas.length) * 100, 40)
      const score = Math.round(Math.max(0, 100 - jitterPenalty - dropPenalty))

      resolve({
        refreshRate,
        meanFrameTime,
        jitter,
        droppedFrames,
        score,
        deviceInfo: getDeviceInfo(),
      })
    }

    requestAnimationFrame(tick)
  })
}
