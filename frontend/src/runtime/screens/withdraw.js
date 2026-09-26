import { withdraw } from '../../api/run.js'
import { h, renderScreen } from '../dom.js'

// Standalone screen at /run/withdraw — participant pastes their code to delete their data.
export function withdrawScreen(root) {
  const input = h('input', {
    type: 'text',
    placeholder: 'Withdraw code',
    style: 'font-family:monospace;font-size:1.1rem;padding:8px;text-align:center',
  })
  const message = h('p', { text: '' })

  const submit = async () => {
    const code = input.value.trim()
    if (!code) return
    try {
      await withdraw(code)
      message.textContent = 'Your data has been deleted.'
      input.disabled = true
    } catch (err) {
      message.textContent =
        err.status === 404 ? 'That code was not found.' : 'Something went wrong. Try again.'
    }
  }

  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [
      h('h1', { text: 'Withdraw your data' }),
      h('p', { text: 'Enter the withdraw code shown at the end of your session.' }),
      input,
      h('button', { class: 'rt-btn', onClick: submit, text: 'Delete my data' }),
      message,
    ])
  )
}
