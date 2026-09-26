import { Renderer } from './renderer.js'
import { Scheduler } from './scheduler.js'
import { waitForResponse } from './input.js'
import { buildBlockTrials, createSeededRandom } from './randomizer.js'
import { walkFlow } from './flow.js'
import { scoreTrial } from './score.js'

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

// Branch/intro scoring for one trial: a keyed trial left unanswered counts as an error
// here (the recorded `correct` stays null), so a participant who never presses can't
// look like 0/0 to a retry branch.
export function branchScore(trial, correct, response) {
  if (correct === null && response == null && trial.correctKey != null) return false
  return correct
}

// Share of true among scored (non-null) values, or null when nothing is scored (ratings).
export function blockAccuracy(scores = []) {
  const scored = scores.filter((s) => s !== null)
  return scored.length ? scored.filter(Boolean).length / scored.length : null
}

async function runTrial(trial, { renderer, scheduler, assets, blockId, trialIndex }) {
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
  let responsePromise

  const frameResult = await scheduler.run(intendedFrames, (frame) => {
    // Armed on the onset frame so the response window and its timeout start with the
    // stimulus, and no press can predate onset (negative RT).
    if (frame === 0) {
      responsePromise = waitForResponse(trial.validKeys, trial.timeoutMs ?? trial.duration).then((r) => {
        responded = r
      })
    }
    renderer.clear()
    if (trial.stimulus.type === 'text') {
      renderer.drawText(trial.stimulus.content, trial.stimulus.color ? { color: trial.stimulus.color } : undefined)
    } else if (trial.stimulus.type === 'image') {
      const img = assets.images.get(trial.stimulus.url)
      if (img) renderer.drawImage(img)
    }
    return responded !== null
  })

  await responsePromise

  const correct = scoreTrial(trial, responded)
  const rt = responded ? responded.time - frameResult.onsetTime : null

  if (trial.feedback && (trial.feedback.correct || trial.feedback.incorrect)) {
    const tooSlow = !responded && !trial.withhold && trial.correctKey != null
    const text = correct ? trial.feedback.correct : tooSlow ? 'Too slow' : trial.feedback.incorrect
    if (text) {
      renderer.clear()
      renderer.drawFeedback(text, { correct: !!correct })
      await wait(600)
    }
  }

  if (trial.itiMs) {
    renderer.clear()
    await wait(trial.itiMs)
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
  {
    canvas,
    refreshRate = 60,
    seed = Date.now(),
    assets = { images: new Map(), audio: new Map() },
    onProgress,
    onFinish,
    onBlockStart,
    onBlockEnd,
  }
) {
  const renderer = new Renderer(canvas, experiment.settings)
  const scheduler = new Scheduler(refreshRate)
  const worker = new Worker(new URL('./logger.worker.js', import.meta.url), { type: 'module' })

  // One seeded stream for the whole session: the stored seed replays the exact trial order.
  const random = createSeededRandom(seed)
  let trialIndex = 0
  const blockResults = new Map()

  function getMetrics(block) {
    return { accuracy: blockAccuracy(blockResults.get(block.id) ?? []) ?? 0 }
  }

  let blockIndex = 0
  let prevBlock = null
  for (const block of walkFlow(experiment, { getMetrics })) {
    // Runtime shows a "next block" screen; the accuracy just scored lets it explain a practice retry.
    await onBlockStart?.(block, {
      index: blockIndex++,
      repeat: prevBlock === block,
      prev: prevBlock && { block: prevBlock, accuracy: blockAccuracy(blockResults.get(prevBlock.id)) },
    })
    prevBlock = block
    const trials = buildBlockTrials(block, { random })
    const records = []
    const scores = []
    for (const trial of trials) {
      const record = await runTrial(trial, {
        renderer,
        scheduler,
        assets,
        blockId: block.id,
        trialIndex,
      })
      trialIndex++
      records.push(record)
      scores.push(branchScore(trial, record.correct, record.response))
      worker.postMessage({ type: 'log', payload: record })
      onProgress?.(trialIndex)
    }
    blockResults.set(block.id, scores)
    // Upload flush lives in the runtime layer; the next block's intro screen covers the pause.
    await onBlockEnd?.(block, records)
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
