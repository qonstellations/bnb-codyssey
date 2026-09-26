import { experimentSchema } from '../../shared/experimentSchema.js'
import { loadExperiment } from '../../api/run.js'
import { h, renderScreen } from '../dom.js'

function isFeatureSupported() {
  return (
    typeof window.AudioContext !== 'undefined' &&
    typeof window.requestAnimationFrame !== 'undefined' &&
    typeof window.IndexedDB !== 'undefined' &&
    typeof Worker !== 'undefined'
  )
}

// Fetches + validates the experiment for `slug`. Throws with a `.kind` the caller
// switches on to pick the right error screen: 'unsupported' | 'not_found' | 'gone' | 'network'.
export async function loadingScreen(root, slug) {
  renderScreen(
    root,
    h('div', { class: 'rt-screen' }, [h('h1', { text: 'Loading...' })])
  )

  if (!isFeatureSupported()) {
    const err = new Error('Unsupported browser')
    err.kind = 'unsupported'
    throw err
  }

  let data
  try {
    data = await loadExperiment(slug)
  } catch (err) {
    if (err.status === 404) err.kind = 'not_found'
    else if (err.status === 410) err.kind = 'gone'
    else err.kind = 'network'
    throw err
  }

  const snapshot = data.experiment.snapshot
  const parsed = experimentSchema.safeParse(snapshot)
  if (!parsed.success) {
    const err = new Error('Experiment failed validation')
    err.kind = 'network'
    throw err
  }

  return { title: data.experiment.title, experiment: parsed.data }
}
