// Seeded PRNG (mulberry32) so a session's trial order is reproducible from its seed.
function mulberry32(seed) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSeededRandom(seed = Date.now()) {
  return mulberry32(seed)
}

export function shuffle(array, random = Math.random) {
  const result = array.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function violatesMaxRepeats(array, maxRepeats, key) {
  let run = 1
  for (let i = 1; i < array.length; i++) {
    if (key(array[i]) === key(array[i - 1])) {
      run++
      if (run > maxRepeats) return true
    } else {
      run = 1
    }
  }
  return false
}

// Reshuffles until no run of `key(item)` exceeds maxRepeats, or gives up after safetyLimit tries.
export function shuffleWithMaxRepeats(
  array,
  maxRepeats,
  { random = Math.random, key = (item) => item.condition, safetyLimit = 200 } = {}
) {
  if (!maxRepeats || array.length <= 1) return shuffle(array, random)
  let attempt = shuffle(array, random)
  let tries = 0
  while (violatesMaxRepeats(attempt, maxRepeats, key) && tries < safetyLimit) {
    attempt = shuffle(array, random)
    tries++
  }
  return attempt
}

// Repeats a block's trial list `repetitions` times, shuffling each repetition independently.
export function buildBlockTrials(block, { random = Math.random } = {}) {
  const repetitions = block.repetitions ?? 1
  let trials = []
  for (let r = 0; r < repetitions; r++) {
    const set = block.shuffle
      ? shuffleWithMaxRepeats(block.trials, block.maxRepeats, { random })
      : block.trials.slice()
    trials = trials.concat(set)
  }
  return trials
}
