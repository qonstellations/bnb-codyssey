const OPERATORS = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
}

function evalCondition(condition, metrics) {
  const value = metrics[condition.metric]
  const op = OPERATORS[condition.operator]
  if (value === undefined || !op) return false
  return op(value, condition.value)
}

// Walks blocks in order, following branches/loops based on live block metrics
// (e.g. { accuracy: 0.6 } from the block just run). Guards against infinite loops
// with a hard step ceiling — loop node repeat counts are still respected below that.
export function* walkFlow(experiment, { getMetrics, maxSteps = 500 } = {}) {
  const blocks = experiment.blocks
  const blockIndex = new Map(blocks.map((b, i) => [b.id, i]))
  const loopCounts = new Map()

  let currentIndex = 0
  let steps = 0

  while (currentIndex < blocks.length && steps < maxSteps) {
    const block = blocks[currentIndex]
    yield block
    steps++

    const metrics = getMetrics ? getMetrics(block) : {}

    const loop = experiment.loops.find((l) => l.from === block.id)
    if (loop) {
      const count = loopCounts.get(loop.id) ?? 0
      if (count < loop.times) {
        loopCounts.set(loop.id, count + 1)
        currentIndex = blockIndex.get(loop.to) ?? currentIndex + 1
        continue
      }
    }

    const branch = experiment.branches.find((b) => b.from === block.id)
    if (branch && evalCondition(branch.condition, metrics)) {
      currentIndex = blockIndex.get(branch.to) ?? currentIndex + 1
      continue
    }

    currentIndex++
  }
}
