import { h, renderScreen } from '../dom.js'

export function completeScreen(root, withdrawCode) {
  // No clipboard on insecure origins (http://<LAN-IP>) — highlight the code so
  // the participant can copy it by hand instead of a button that does nothing.
  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(withdrawCode).catch(() => {})
      return
    }
    const code = root.querySelector('.rt-code')
    if (!code) return
    const range = document.createRange()
    range.selectNodeContents(code)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }
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
