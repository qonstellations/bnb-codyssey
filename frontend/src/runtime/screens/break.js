import { h, renderScreen } from '../dom.js'

const pct = (a) => `${Math.round(a * 100)}%`

// Shown before every block after the first: says what's next, and why when a practice
// block repeats. Resolves on Continue (Enter/Space work too — the button is focused).
export function blockIntroScreen(root, { block, repeat, prev }) {
  const scored = prev?.accuracy != null
  let kicker = 'Nice work'
  let title = `Next: ${block.label || 'next part'}`
  let text = 'Take a short break if you need one, then continue when you are ready.'
  if (repeat) {
    kicker = scored ? `You scored ${pct(prev.accuracy)}` : 'Almost there'
    title = `Let's practise ${block.label ? `“${block.label}” ` : ''}once more`
    text = 'Read the instructions again in your head, then try to be accurate before being fast.'
  } else if (scored) {
    kicker = `${prev.block.label || 'That part'} done · ${pct(prev.accuracy)} correct`
  }

  return new Promise((resolve) => {
    renderScreen(
      root,
      h('div', { class: 'rt-screen' }, [
        h('p', { class: 'rt-kicker', text: kicker }),
        h('h1', { text: title }),
        h('p', { text }),
        h('button', { class: 'rt-btn', onClick: resolve, text: 'Continue' }),
      ])
    )
  })
}
