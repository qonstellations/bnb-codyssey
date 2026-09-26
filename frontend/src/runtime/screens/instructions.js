import { unlockAudio } from '../../engine/audio.js'
import { h, keyLabel, renderScreen } from '../dom.js'

// Resolves once the participant clicks Start. That click is also the one user gesture
// this app gets to unlock audio and (optionally) enter fullscreen.
export function instructionsScreen(root, { instructionsText, fullscreen }, keys = []) {
  return new Promise((resolve) => {
    const start = async () => {
      unlockAudio()
      if (fullscreen && document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen()
        } catch {
          // fullscreen denial isn't fatal — continue without it
        }
      }
      resolve()
    }

    renderScreen(
      root,
      h('div', { class: 'rt-screen' }, [
        h('p', { class: 'rt-kicker', text: 'Before you begin' }),
        h('h1', { text: 'How this works' }),
        h('div', { class: 'rt-card' }, [h('p', { text: instructionsText || 'Follow the on-screen prompts.' })]),
        ...(keys.length
          ? [h('div', { class: 'rt-keys', 'aria-label': 'Response keys' }, keys.map((k) => h('span', { class: 'rt-kbd', text: keyLabel(k) })))]
          : []),
        h('p', { class: 'rt-hint', text: 'Keep your fingers on these keys. Be as fast and accurate as you can.' }),
        h('button', { class: 'rt-btn', onClick: start, text: 'Start' }),
      ])
    )
  })
}

export function preloadScreen(root) {
  const bar = h('div', { class: 'rt-progress-bar', style: 'width:0%' })
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: 'Getting things ready…' }),
      h('div', { class: 'rt-progress' }, [bar]),
    ])
  )
  return (loaded, total) => {
    bar.style.width = `${total ? Math.round((loaded / total) * 100) : 100}%`
  }
}
