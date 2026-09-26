import { h, renderScreen } from '../dom.js'

export function completeScreen(root, withdrawCode) {
  const copy = () => navigator.clipboard?.writeText(withdrawCode).catch(() => {})
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: 'Thank you for participating!' }),
      h('p', {
        text: 'Save this code if you ever want your data removed from the study.',
      }),
      h('div', { class: 'rt-code', text: withdrawCode }),
      h('button', { class: 'rt-btn rt-btn-secondary', onClick: copy, text: 'Copy code' }),
    ])
  )
}

export function uploadFailedScreen(root, { onRetry }) {
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: 'Saving your data...' }),
      h('p', { text: "Some data hasn't uploaded yet. Please don't close this tab." }),
      h('button', { class: 'rt-btn', onClick: onRetry, text: 'Retry now' }),
    ])
  )
}
