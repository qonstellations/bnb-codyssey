import { experimentSchema } from '../../shared/experimentSchema.js'
import { loadExperiment } from '../../api/run.js'
import { demoGetPublishedDraft } from '../../api/demoBackend.js'
import { h, renderScreen } from '../dom.js'

function isFeatureSupported() {
  return (
    typeof window.AudioContext !== 'undefined' &&
    typeof window.requestAnimationFrame !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
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
    // Demo fallback: a demo-published experiment lives only in this browser's
    // localStorage, so serve it locally instead of failing when the backend
    // is unreachable or doesn't know the slug.
    const demo = demoGetPublishedDraft(slug)
    if (demo) {
      const parsed = experimentSchema.safeParse(demo.draft)
      if (parsed.success) return { title: demo.title ?? 'Experiment', experiment: parsed.data, demo: true }
    }
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
