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

// Walks blocks in order. A `loops` entry ({ blockId, repetitions }) repeats that block
// in place `repetitions` times. A `branches` entry ({ from, to, condition }) can jump
// elsewhere (including back to itself) once its condition matches live block metrics
// (e.g. { accuracy: 0.6 } from the block just run). `maxSteps` guards both mechanisms
// against an infinite cycle (e.g. a branch that always re-triggers on its own target).
export function* walkFlow(experiment, { getMetrics, maxSteps = 500 } = {}) {
  const blocks = experiment.blocks
  const blockIndex = new Map(blocks.map((b, i) => [b.id, i]))
  const loopByBlock = new Map(experiment.loops.map((l) => [l.blockId, l]))

  let currentIndex = 0
  let steps = 0

  while (currentIndex < blocks.length && steps < maxSteps) {
    const block = blocks[currentIndex]
    const loop = loopByBlock.get(block.id)
    const repeatTimes = loop ? loop.repetitions : 1
    let jumped = false

    for (let i = 0; i < repeatTimes && steps < maxSteps; i++) {
      yield block
      steps++

      const metrics = getMetrics ? getMetrics(block) : {}
      const branch = experiment.branches.find((b) => b.from === block.id)
      if (branch && evalCondition(branch.condition, metrics)) {
        currentIndex = blockIndex.get(branch.to) ?? currentIndex + 1
        jumped = true
        break
      }
    }

    if (!jumped) currentIndex++
  }
}
