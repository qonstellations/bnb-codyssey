import { Renderer } from './renderer.js'
import { Scheduler } from './scheduler.js'
import { waitForResponse } from './input.js'
import { buildBlockTrials } from './randomizer.js'
import { walkFlow } from './flow.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Counts tab switches/blur and fullscreen exits for the duration of the experiment.
// Exported separately since runtime screens (consent/instructions) also want screen-time tracking.
export function trackEngagement() {
  let tabSwitches = 0
  let blurCount = 0
  let fullscreenExits = 0
  const screenStartTimes = new Map()

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') tabSwitches++
  }
  const onBlur = () => blurCount++
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) fullscreenExits++
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  document.addEventListener('fullscreenchange', onFullscreenChange)

  return {
    markScreenStart(name) {
      screenStartTimes.set(name, performance.now())
    },
    getScreenTime(name) {
      const start = screenStartTimes.get(name)
      return start ? performance.now() - start : null
    },
    getCounts() {
      return { tabSwitches, blurCount, fullscreenExits }
    },
    stop() {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    },
  }
}

async function runTrial(trial, { renderer, scheduler, worker, assets, blockId, trialIndex }) {
  const fixFrames = scheduler.msToFrames(trial.fixationDuration)
  if (fixFrames > 0) {
    await scheduler.run(fixFrames, () => {
      renderer.clear()
      renderer.drawFixation()
      return false
    })
  }

  const intendedFrames = scheduler.msToFrames(trial.duration)
  let responded = null
  const responsePromise = waitForResponse(trial.validKeys, trial.timeout ?? trial.duration).then(
    (r) => {
      responded = r
    }
  )

  const frameResult = await scheduler.run(intendedFrames, () => {
    renderer.clear()
    if (trial.stimulus.type === 'text') {
      renderer.drawText(trial.stimulus.content)
    } else if (trial.stimulus.type === 'image') {
      const img = assets.images.get(trial.stimulus.url)
      if (img) renderer.drawImage(img)
    }
    return responded !== null
  })

  await responsePromise

  const correct = responded ? responded.key === trial.correctKey : null
  const rt = responded ? responded.time - frameResult.onsetTime : null

  if (trial.feedback && (trial.feedback.correct || trial.feedback.incorrect)) {
    const text = correct ? trial.feedback.correct : trial.feedback.incorrect
    if (text) {
      renderer.clear()
      renderer.drawFeedback(text, { correct: !!correct })
      await wait(600)
    }
  }

  if (trial.iti) {
    renderer.clear()
    await wait(trial.iti)
  }

  return {
    trialIndex,
    blockId,
    condition: trial.condition,
    stimulus: trial.stimulus,
    response: responded?.key ?? null,
    correct,
    rt,
    frameData: {
      intended: frameResult.intended,
      actual: frameResult.actual,
      dropped: frameResult.dropped,
    },
  }
}

// Runs the whole experiment: fixation -> stimulus -> response -> feedback -> ITI -> log, per trial.
export async function runExperiment(
  experiment,
  { canvas, refreshRate = 60, assets = { images: new Map(), audio: new Map() }, onProgress, onFinish }
) {
  const renderer = new Renderer(canvas, experiment.settings)
  const scheduler = new Scheduler(refreshRate)
  const worker = new Worker(new URL('./logger.worker.js', import.meta.url), { type: 'module' })

  let trialIndex = 0
  const blockResults = new Map()

  function getMetrics(block) {
    const records = blockResults.get(block.id) ?? []
    const scored = records.filter((r) => r.correct !== null)
    const accuracy = scored.length ? scored.filter((r) => r.correct).length / scored.length : 0
    return { accuracy }
  }

  for (const block of walkFlow(experiment, { getMetrics })) {
    const trials = buildBlockTrials(block)
    const records = []
    for (const trial of trials) {
      const record = await runTrial(trial, {
        renderer,
        scheduler,
        worker,
        assets,
        blockId: block.id,
        trialIndex,
      })
      trialIndex++
      records.push(record)
      worker.postMessage({ type: 'log', payload: record })
      onProgress?.(trialIndex)
    }
    blockResults.set(block.id, records)
  }

  renderer.destroy()
  worker.postMessage({ type: 'flush' })
  const allRecords = await new Promise((resolve) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'flushed') resolve(e.data.payload)
    }
  })
  worker.terminate()

  onFinish?.(allRecords)
  return allRecords
}
