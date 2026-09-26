import './style.css'
import { experimentKeys, h, keyLabel, renderScreen } from './dom.js'
import { loadingScreen } from './screens/loading.js'
import { consentScreen, declinedScreen } from './screens/consent.js'
import { checkScreen } from './screens/check.js'
import { instructionsScreen, preloadScreen } from './screens/instructions.js'
import { blockIntroScreen } from './screens/break.js'
import { completeScreen, uploadFailedScreen } from './screens/complete.js'
import { withdrawScreen } from './screens/withdraw.js'
import {
  notFoundScreen,
  goneScreen,
  unsupportedBrowserScreen,
  errorScreen,
} from './screens/error.js'
import { preloadExperiment } from '../engine/preloader.js'
import { runExperiment, trackEngagement } from '../engine/index.js'
import { FONT_FAMILY } from '../engine/renderer.js'
import { createUploader } from '../engine/uploader.js'
import { startSession, updateSession, completeSession } from '../api/run.js'
import { experimentSchema } from '../shared/experimentSchema.js'

const root = document.getElementById('root')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Trial canvas plus the static layers over it. The canvas stays mounted for the whole run
// (block intros render into `overlay`), so the renderer keeps its size and context.
// Nothing here changes during a stimulus: the progress bar moves once per finished trial.
function trialStage(experiment, keys) {
  const { backgroundColor = '#000', textColor = '#fff', showProgressBar } = experiment.settings
  const canvas = h('canvas', { class: 'rt-canvas', style: `background:${backgroundColor}` })
  const overlay = h('div', { class: 'rt-overlay' })
  const layers = [canvas, overlay]

  let bar = null
  if (showProgressBar) {
    bar = h('div', { style: 'width:0%' })
    layers.push(h('div', { class: 'rt-trialbar', style: `color:${textColor}` }, [bar]))
  }

  // Touch-only devices get one big button per response key (input.js reads data-key).
  const padKeys = keys.filter((k) => k !== 'click')
  if (padKeys.length && window.matchMedia?.('(pointer: coarse)').matches) {
    layers.push(
      h('div', { class: 'rt-pad' }, padKeys.map((k) => h('button', { type: 'button', 'data-key': k, tabindex: '-1', text: keyLabel(k) })))
    )
  }

  // ponytail: planned trial count ignores branch retries; the bar just holds at 100% then.
  const total = experiment.blocks.reduce((n, b) => {
    const loop = experiment.loops.find((l) => l.blockId === b.id)
    return n + b.trials.length * (b.repetitions ?? 1) * (loop?.repetitions ?? 1)
  }, 0)

  return {
    el: h('div', { class: 'rt-stage' }, layers),
    canvas,
    overlay,
    progress: (done) => {
      if (bar) bar.style.width = `${Math.min(100, (done / total) * 100)}%`
    },
  }
}

// Builder → Preview writes the compiled draft here. localStorage, not sessionStorage:
// a tab opened with window.open doesn't reliably inherit the opener's sessionStorage.
async function loadPreview() {
  let raw = null
  try {
    raw = localStorage.getItem('preview-experiment')
  } catch {
    // storage blocked — falls through to the "nothing to preview" error
  }
  const parsed = experimentSchema.safeParse(JSON.parse(raw ?? 'null'))
  if (!parsed.success) {
    const err = new Error('Invalid preview data')
    err.kind = 'network'
    throw err
  }
  return { title: 'Preview', experiment: parsed.data }
}

async function main() {
  const path = window.location.pathname
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1'

  if (path === '/run/withdraw') {
    withdrawScreen(root)
    return
  }

  // Preview runs from /run.html?preview=1 with no slug — only real runs need one.
  const slugMatch = path.match(/^\/run\/([^/]+)/)
  if (!slugMatch && !isPreview) return notFoundScreen(root)
  const slug = slugMatch?.[1]

  let experiment
  try {
    ;({ experiment } = isPreview ? await loadPreview() : await loadingScreen(root, slug))
  } catch (err) {
    if (err.kind === 'not_found') return notFoundScreen(root)
    if (err.kind === 'gone') return goneScreen(root)
    if (err.kind === 'unsupported') return unsupportedBrowserScreen(root)
    if (isPreview) {
      return errorScreen(root, { title: 'Nothing to preview', message: 'Open Preview again from the builder.' })
    }
    return errorScreen(root, {
      title: 'Could not load',
      message: 'Check your connection and try again.',
      onRetry: main,
    })
  }

  const agreed = await consentScreen(root, experiment.settings.consentText)
  if (!agreed) return declinedScreen(root)

  const calibration = await checkScreen(root)

  let sessionId
  let withdrawCode
  if (!isPreview) {
    try {
      ;({ sessionId, withdrawCode } = await startSession(slug, calibration.deviceInfo))
      await updateSession(sessionId, {
        calibration: {
          refreshRate: calibration.refreshRate,
          jitter: calibration.jitter,
          score: calibration.score,
        },
      })
    } catch {
      return errorScreen(root, {
        title: 'Could not start session',
        message: 'Check your connection and try again.',
        onRetry: main,
      })
    }
  }

  const keys = experimentKeys(experiment)
  await instructionsScreen(root, experiment.settings, keys)

  const onProgress = preloadScreen(root)
  const [assets] = await Promise.all([
    preloadExperiment(experiment, { onProgress }),
    // Canvas text must not swap fonts mid-trial; capped so an offline font never blocks the run.
    Promise.race([document.fonts?.load(`450 48px ${FONT_FAMILY}`).catch(() => {}), wait(1500)]),
  ])

  const stage = trialStage(experiment, keys)
  root.replaceChildren(stage.el)

  const uploader = isPreview ? null : createUploader({ sessionId })
  let pendingTrials = []
  let flushed = Promise.resolve()
  uploader?.attachUnloadHandlers(() => pendingTrials)

  const engagement = trackEngagement()

  await runExperiment(experiment, {
    canvas: stage.canvas,
    refreshRate: calibration.refreshRate,
    assets,
    onProgress: stage.progress,
    onBlockStart: async (block, info) => {
      if (info.index === 0) return
      await blockIntroScreen(stage.overlay, { block, ...info })
      stage.overlay.replaceChildren()
    },
    onBlockEnd: (block, records) => {
      pendingTrials = pendingTrials.concat(records)
      if (!uploader) return
      // Uploads in the background while the next block's intro screen is up.
      const toFlush = pendingTrials
      pendingTrials = []
      flushed = uploader.flush(toFlush).catch(() => {
        pendingTrials = pendingTrials.concat(toFlush)
      })
    },
  })

  engagement.stop()
  await flushed

  if (isPreview) {
    renderScreen(root, h('div', { class: 'rt-screen' }, [h('h1', { text: 'Preview complete' })]))
    return
  }

  try {
    const result = await completeSession(sessionId)
    completeScreen(root, result.withdrawCode ?? withdrawCode)
  } catch {
    uploadFailedScreen(root, {
      onRetry: async () => {
        const result = await completeSession(sessionId).catch(() => null)
        if (result) completeScreen(root, result.withdrawCode ?? withdrawCode)
      },
    })
  }
}

main()
