import { runCalibration } from '../../engine/calibration.js'
import { h, renderScreen } from '../dom.js'

const MIN_SCORE = 50
const MIN_WIDTH = 800

// Runs calibration and shows a warning (not a hard block) if quality looks poor.
export async function checkScreen(root) {
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [h('h1', { text: 'Checking your device...' })])
  )

  const result = await runCalibration()
  const warnings = []
  if (result.score < MIN_SCORE) warnings.push('Your device may not display timing accurately.')
  if (window.innerWidth < MIN_WIDTH) warnings.push('Your screen is quite small for this study.')

  if (warnings.length === 0) return result

  await new Promise((resolve) => {
    renderScreen(
      root,
      h('div', { class: 'rt-screen' }, [
        h('h1', { text: 'Heads up' }),
        ...warnings.map((w) => h('p', { text: w })),
        h('button', { class: 'rt-btn', onClick: resolve, text: 'Continue anyway' }),
      ])
    )
  })

  return result
}
