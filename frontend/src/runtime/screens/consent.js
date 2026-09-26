import { h, renderScreen } from '../dom.js'

// Resolves true if the participant agrees, false if they decline.
export function consentScreen(root, consentText) {
  return new Promise((resolve) => {
    renderScreen(
      root,
      h('div', { class: 'rt-screen' }, [
        h('h1', { text: 'Consent' }),
        h('p', { text: consentText || 'You are being asked to participate in a research study.' }),
        h('div', { style: 'display:flex;gap:12px' }, [
          h('button', { class: 'rt-btn', onClick: () => resolve(true), text: 'I agree' }),
          h('button', {
            class: 'rt-btn rt-btn-secondary',
            onClick: () => resolve(false),
            text: 'Decline',
          }),
        ]),
      ])
    )
  })
}

export function declinedScreen(root) {
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: 'Thank you' }),
      h('p', { text: 'You have declined to participate. No data has been collected.' }),
    ])
  )
}
