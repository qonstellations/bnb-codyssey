export class Scheduler {
  constructor(refreshRate = 60) {
    this.refreshRate = refreshRate
    this.frameMs = 1000 / refreshRate
  }

  msToFrames(ms) {
    return Math.round(ms / this.frameMs)
  }

  // Calls onFrame(callIndex, timestamp) once per rAF callback, up to `intendedFrames` calls.
  // Resolves early if onFrame returns true (e.g. response received).
  // `dropped` counts monitor refreshes skipped between callbacks (gap >> one frame).
  run(intendedFrames, onFrame) {
    return new Promise((resolve) => {
      let onsetTime = null
      let calls = 0
      let dropped = 0
      let lastTime = null
      let stopped = false

      const step = (now) => {
        if (stopped) return
        if (onsetTime === null) onsetTime = now
        if (lastTime !== null) {
          const gap = now - lastTime
          if (gap > this.frameMs * 1.5) {
            dropped += Math.round(gap / this.frameMs) - 1
          }
        }
        lastTime = now
        calls++

        const stop = onFrame(calls - 1, now)
        if (stop || calls >= intendedFrames) {
          stopped = true
          resolve({
            onsetTime,
            intended: intendedFrames,
            actual: Math.max(0, intendedFrames - dropped),
            dropped,
          })
          return
        }
        requestAnimationFrame(step)
      }

      requestAnimationFrame(step)
    })
  }
}
