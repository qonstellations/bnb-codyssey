let sharedContext = null

// Browsers suspend AudioContext until a user gesture; call this from the Start-button handler.
export function unlockAudio() {
  if (!sharedContext) sharedContext = new (window.AudioContext || window.webkitAudioContext)()
  if (sharedContext.state === 'suspended') sharedContext.resume()
  return sharedContext
}

export function getAudioContext() {
  return sharedContext
}

export async function decodeAudio(arrayBuffer) {
  const ctx = getAudioContext()
  if (!ctx) throw new Error('AudioContext not unlocked yet — call unlockAudio() first')
  return ctx.decodeAudioData(arrayBuffer)
}

// `when` is an AudioContext time (ctx.currentTime + offset), not Date.now().
export function play(buffer, when = 0) {
  const ctx = getAudioContext()
  if (!ctx) throw new Error('AudioContext not unlocked yet — call unlockAudio() first')
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(when)
  return source
}
