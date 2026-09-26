import { unlockAudio } from '../../engine/audio.js'
import { h, renderScreen } from '../dom.js'

// Resolves once the participant clicks Start. That click is also the one user gesture
// this app gets to unlock audio and (optionally) enter fullscreen.
export function instructionsScreen(root, { instructionsText, fullscreen }) {
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
        h('h1', { text: 'Instructions' }),
        h('p', { text: instructionsText || '' }),
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
      h('h1', { text: 'Preparing your experiment...' }),
      h('div', { class: 'rt-progress' }, [bar]),
    ])
  )
  return (loaded, total) => {
    bar.style.width = `${total ? Math.round((loaded / total) * 100) : 100}%`
  }
}
