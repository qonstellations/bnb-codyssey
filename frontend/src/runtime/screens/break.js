import { h, renderScreen } from '../dom.js'

// Shown between blocks while pending trial data uploads. Resolves once the
// participant continues (upload happens concurrently, not blocking the click).
export function breakScreen(root) {
  return new Promise((resolve) => {
    renderScreen(
      root,
      h('div', { class: 'rt-screen' }, [
        h('h1', { text: 'Take a short break' }),
        h('button', { class: 'rt-btn', onClick: resolve, text: 'Continue' }),
      ])
    )
  })
}
