import { decodeAudio } from './audio.js'

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    img.decode()
      .then(() => resolve(img))
      .catch(() => reject(new Error(`Failed to load image: ${url}`)))
  })
}

async function loadAudio(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch audio: ${url}`)
  const arrayBuffer = await response.arrayBuffer()
  return decodeAudio(arrayBuffer)
}

// Collects every stimulus URL referenced by the experiment's trials.
export function collectAssetUrls(experiment) {
  const images = new Set()
  const audio = new Set()
  for (const block of experiment.blocks) {
    for (const trial of block.trials) {
      if (!trial.stimulus?.url) continue
      if (trial.stimulus.type === 'image') images.add(trial.stimulus.url)
      if (trial.stimulus.type === 'audio') audio.add(trial.stimulus.url)
    }
  }
  return { images: [...images], audio: [...audio] }
}

// Loads every asset, reporting progress. Returns { images: Map<url, Image>, audio: Map<url, AudioBuffer> }.
export async function preloadExperiment(experiment, { onProgress } = {}) {
  const { images, audio } = collectAssetUrls(experiment)
  const total = images.length + audio.length
  let loaded = 0
  const report = () => onProgress?.(loaded, total)
  report()

  const imageMap = new Map()
  const audioMap = new Map()

  await Promise.all([
    ...images.map(async (url) => {
      imageMap.set(url, await loadImage(url))
      loaded++
      report()
    }),
    ...audio.map(async (url) => {
      audioMap.set(url, await loadAudio(url))
      loaded++
      report()
    }),
  ])

  return { images: imageMap, audio: audioMap }
}
