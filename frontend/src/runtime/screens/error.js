import { h, renderScreen } from '../dom.js'

export function errorScreen(root, { title, message, onRetry }) {
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: title }),
      h('p', { text: message }),
      ...(onRetry ? [h('button', { class: 'rt-btn', onClick: onRetry, text: 'Retry' })] : []),
    ])
  )
}

export function notFoundScreen(root) {
  errorScreen(root, { title: 'Not found', message: 'This experiment link is not valid.' })
}

export function goneScreen(root) {
  errorScreen(root, {
    title: 'Study closed',
    message: 'This study is no longer accepting participants. Thank you for your interest.',
  })
}

export function unsupportedBrowserScreen(root) {
  errorScreen(root, {
    title: 'Unsupported browser',
    message: 'Please open this link in an up-to-date modern browser (Chrome, Firefox, Safari, Edge, Brave or similar).',
  })
}
