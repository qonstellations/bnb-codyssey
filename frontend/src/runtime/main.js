import './style.css'
import { h, renderScreen } from './dom.js'
import { loadingScreen } from './screens/loading.js'
import { consentScreen, declinedScreen } from './screens/consent.js'
import { checkScreen } from './screens/check.js'
import { instructionsScreen, preloadScreen } from './screens/instructions.js'
import { breakScreen } from './screens/break.js'
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
import { createUploader } from '../engine/uploader.js'
import { startSession, updateSession, completeSession } from '../api/run.js'
import { experimentSchema } from '../shared/experimentSchema.js'

const root = document.getElementById('root')

async function loadPreview() {
  const raw = sessionStorage.getItem('preview-experiment')
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

  const slugMatch = path.match(/^\/run\/([^/]+)/)
  if (!slugMatch) return notFoundScreen(root)
  const slug = slugMatch[1]

  let experiment
  try {
    ;({ experiment } = isPreview ? await loadPreview() : await loadingScreen(root, slug))
  } catch (err) {
    if (err.kind === 'not_found') return notFoundScreen(root)
    if (err.kind === 'gone') return goneScreen(root)
    if (err.kind === 'unsupported') return unsupportedBrowserScreen(root)
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

  await instructionsScreen(root, experiment.settings)

  const onProgress = preloadScreen(root)
  const assets = await preloadExperiment(experiment, { onProgress })

  const canvas = document.createElement('canvas')
  canvas.className = 'rt-canvas'
  root.replaceChildren(canvas)

  const uploader = isPreview ? null : createUploader({ sessionId })
  let pendingTrials = []
  uploader?.attachUnloadHandlers(() => pendingTrials)

  const engagement = trackEngagement()
  const lastBlock = experiment.blocks[experiment.blocks.length - 1]

  await runExperiment(experiment, {
    canvas,
    refreshRate: calibration.refreshRate,
    assets,
    onBlockEnd: async (block, records) => {
      pendingTrials = pendingTrials.concat(records)
      if (!uploader) return

      // ponytail: "last block" is a simple array-position check, not flow-aware —
      // a branch/loop that ends the run on an earlier-indexed block still shows one
      // extra break screen. Upgrade to flow-aware detection if that proves annoying.
      const toFlush = pendingTrials
      pendingTrials = []
      const flushed = uploader.flush(toFlush).catch(() => {
        pendingTrials = pendingTrials.concat(toFlush)
      })

      if (block !== lastBlock) await breakScreen(root)
      await flushed
      root.replaceChildren(canvas)
    },
  })

  engagement.stop()

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
