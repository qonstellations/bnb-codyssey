import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow } from '@xyflow/react'
import { Button, Group, Modal, Slider, Text } from '@mantine/core'
import { nodeTypes } from './nodes/index.js'
import { compileToGraph } from './compile.js'
import { conditionText } from './format.js'

// Interactive guide for new researchers: four short chapters, each a small
// hands-on scene built from the real builder pieces (node cards, flow layout).

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const CHAPTERS = [
  { title: 'Your experiment is a path', short: 'The path' },
  { title: 'Three building blocks', short: 'Building blocks' },
  { title: 'What participants see', short: 'A trial' },
  { title: 'From idea to results', short: 'Your workflow' },
]

// ─── Chapter 1: live path with a decision ──────────────────
const DEMO_TRIAL = { stimulus: { type: 'text', content: '+' }, duration: 1500, fixationDuration: 500, validKeys: ['f'] }
const DEMO_DRAFT = {
  blocks: [
    { id: 'practice', label: 'Practice', trials: Array(8).fill(DEMO_TRIAL) },
    { id: 'main', label: 'Main task', trials: Array(40).fill(DEMO_TRIAL) },
  ],
  branches: [{ id: 'decision', from: 'practice', to: 'practice', condition: { metric: 'accuracy', operator: '<', value: 0.7 } }],
  loops: [],
}
const THRESHOLD = 0.7
const EDGE_STYLE = { type: 'smoothstep', pathOptions: { borderRadius: 16 } }

// Steps a participant takes, as [nodeId, edgeIdUsedToGetThere, caption].
function participantPath(accuracy) {
  const pct = Math.round(accuracy * 100)
  const steps = [
    ['start', null, 'The participant opens your link and gives consent.'],
    ['practice', 'start-practice', 'They do the Practice task (8 trials).'],
    ['decision', 'practice-decision', `Decision checks their score: ${pct}% accuracy.`],
  ]
  if (accuracy < THRESHOLD) {
    steps.push(['practice', 'decision-practice', `${pct}% is below 70% → back to Practice for another go.`])
    steps.push(['decision', 'practice-decision', 'Second attempt: 85% accuracy.'])
  }
  steps.push(['main', 'practice-main', `${accuracy < THRESHOLD ? '85' : pct}% is 70% or more → on to the Main task.`])
  steps.push(['end', 'main-end', 'Done! Their responses are saved to your Results.'])
  return steps
}

function PathChapter() {
  const base = useMemo(() => compileToGraph(DEMO_DRAFT), [])
  const [accuracy, setAccuracy] = useState(0.55)
  const [step, setStep] = useState(-1)
  const timer = useRef(null)
  const steps = useMemo(() => participantPath(accuracy), [accuracy])

  useEffect(() => () => clearTimeout(timer.current), [])

  function play() {
    clearTimeout(timer.current)
    let i = 0
    const tick = () => {
      setStep(i)
      if (++i < steps.length) timer.current = setTimeout(tick, REDUCED ? 300 : 1100)
    }
    tick()
  }

  const current = steps[step]
  const nodes = base.nodes.map((n) => ({ ...n, className: current?.[0] === n.id ? 'hiw-active' : '' }))
  const edges = base.edges.map((e) => ({ ...EDGE_STYLE, ...e, animated: current?.[1] === e.id, className: current?.[1] === e.id ? 'hiw-edge-active' : '' }))

  return (
    <div className="hiw-chapter">
      <Text className="hiw-lead">
        Participants walk from <b>Start</b> to <b>End</b>. Tasks run trials; a <b>Decision</b> can send them back — here,
        Practice repeats if accuracy is below 70%.
      </Text>
      <div className="hiw-flow">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          colorMode="light"
        />
      </div>
      <div className="hiw-controls">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Text size="sm" fw={500} mb={6}>
            Participant's practice accuracy: {Math.round(accuracy * 100)}%
          </Text>
          <Slider
            min={0.4}
            max={1}
            step={0.05}
            value={accuracy}
            onChange={(v) => {
              setAccuracy(v)
              setStep(-1)
            }}
            label={(v) => `${Math.round(v * 100)}%`}
            marks={[{ value: THRESHOLD, label: '70%' }]}
            color={accuracy < THRESHOLD ? 'red' : 'green'}
          />
        </div>
        <Button onClick={play} size="md">
          {step >= 0 ? 'Replay' : '▶ Play participant'}
        </Button>
      </div>
      <div className="hiw-caption" aria-live="polite">
        {current ? current[2] : `Drag the slider, then press Play. Rule: ${conditionText(DEMO_DRAFT.branches[0].condition)} → repeat Practice.`}
      </div>
    </div>
  )
}

// ─── Chapter 2: building blocks ────────────────────────────
const BLOCKS = [
  {
    key: 'task',
    name: 'Task',
    color: '#4285f4',
    what: 'A set of trials shown one after another — e.g. Practice or Main task.',
    when: 'Every experiment has at least one. Click a Task to add and edit its trials.',
    diagram: ['Start', 'Task', 'End'],
  },
  {
    key: 'decision',
    name: 'Decision',
    color: '#fbbc04',
    what: 'Checks the score of the Task before it and sends participants somewhere else if a rule is met.',
    when: 'Repeat practice until accuracy is 70%, or skip ahead for fast responders.',
    diagram: ['Task', 'Decision', '↺ Task again'],
  },
  {
    key: 'repeat',
    name: 'Repeat',
    color: '#a142f4',
    what: 'Runs one Task several times in a row, reshuffling its trials each time.',
    when: 'Five rounds of the same block without copying trials by hand.',
    diagram: ['Task', 'Repeat ×3'],
  },
]

function BlocksChapter() {
  const [open, setOpen] = useState('task')
  return (
    <div className="hiw-chapter">
      <Text className="hiw-lead">You build every experiment from just three pieces. Click one to see what it does.</Text>
      <div className="hiw-blocks">
        {BLOCKS.map((b) => {
          const active = open === b.key
          return (
            <button key={b.key} type="button" className={`hiw-block${active ? ' open' : ''}`} onClick={() => setOpen(b.key)} aria-expanded={active}>
              <div className="flow-card-title" style={{ fontSize: 18 }}>
                <span className="flow-dot" style={{ background: b.color, width: 12, height: 12 }} />
                {b.name}
              </div>
              <p className="hiw-block-what">{b.what}</p>
              {active && (
                <div className="hiw-block-more">
                  <div className="hiw-mini">
                    {b.diagram.map((d, i) => (
                      <span key={d} className="hiw-mini-item">
                        {i > 0 && <span className="hiw-mini-arrow">→</span>}
                        <span className="hiw-mini-node" style={{ borderColor: d.includes(b.name) ? b.color : undefined }}>
                          {d}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="hiw-block-when">
                    <b>Use it for:</b> {b.when}
                  </p>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Chapter 3: try a trial ────────────────────────────────
const INKS = [
  { word: 'RED', hex: '#ea4335', key: 'r' },
  { word: 'GREEN', hex: '#34a853', key: 'g' },
  { word: 'BLUE', hex: '#4285f4', key: 'b' },
  { word: 'YELLOW', hex: '#fbbc04', key: 'y' },
]
const PHASES = [
  ['fixation', 'Fixation', 'fixationDuration'],
  ['stimulus', 'Stimulus', 'stimulus · duration'],
  ['response', 'Response', 'validKeys · correctKey'],
  ['feedback', 'Feedback', 'feedback'],
]
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

function TrialChapter() {
  const [phase, setPhase] = useState('idle') // idle | fixation | stimulus | feedback
  const [trial, setTrial] = useState(null)
  const [result, setResult] = useState(null)
  const t0 = useRef(0)
  const timers = useRef([])

  const clear = () => timers.current.forEach(clearTimeout)
  useEffect(() => clear, [])

  function start() {
    clear()
    const word = pick(INKS)
    const ink = pick(INKS.filter((c) => c !== word))
    setTrial({ word: word.word, ink })
    setResult(null)
    setPhase('fixation')
    timers.current = [
      setTimeout(() => {
        setPhase('stimulus')
        t0.current = performance.now()
      }, 700),
      setTimeout(() => {
        setPhase('feedback')
        setResult((r) => r ?? { timeout: true })
      }, 700 + 3000),
    ]
  }

  function respond(key) {
    if (phase !== 'stimulus') return
    clear()
    setResult({ correct: key === trial.ink.key, ms: Math.round(performance.now() - t0.current), key })
    setPhase('feedback')
  }

  useEffect(() => {
    if (phase !== 'stimulus') return
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if (INKS.some((c) => c.key === k)) respond(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const activePhase = phase === 'stimulus' ? ['stimulus', 'response'] : [phase]

  return (
    <div className="hiw-chapter">
      <Text className="hiw-lead">
        Each Task is a list of <b>trials</b>. Try one — press the key for the <b>ink colour</b>, not the word.
      </Text>
      <div className="hiw-stage">
        {phase === 'idle' && (
          <Button size="lg" variant="white" color="dark" onClick={start}>
            Start a trial
          </Button>
        )}
        {phase === 'fixation' && <span className="hiw-fix">+</span>}
        {phase === 'stimulus' && (
          <span className="hiw-word" style={{ color: trial.ink.hex }}>
            {trial.word}
          </span>
        )}
        {phase === 'feedback' && (
          <div className="hiw-result">
            <div className={`hiw-result-big ${result?.correct ? 'ok' : 'bad'}`}>
              {result?.timeout ? 'Too slow' : result?.correct ? 'Correct!' : 'Incorrect'}
            </div>
            {!result?.timeout && <div className="hiw-result-ms">{result?.ms} ms reaction time</div>}
            <Button mt="md" variant="white" color="dark" onClick={start}>
              Try again
            </Button>
          </div>
        )}
      </div>
      <Group gap={8} justify="center" mt="sm">
        {INKS.map((c) => (
          <button key={c.key} type="button" className="hiw-key" disabled={phase !== 'stimulus'} onClick={() => respond(c.key)}>
            <span className="flow-dot" style={{ background: c.hex }} /> {c.key.toUpperCase()}
          </button>
        ))}
      </Group>
      <div className="hiw-timeline">
        {PHASES.map(([id, name, field]) => (
          <div key={id} className={`hiw-phase${activePhase.includes(id) ? ' active' : ''}`}>
            <div className="hiw-phase-name">{name}</div>
            <code className="hiw-phase-field">{field}</code>
          </div>
        ))}
      </div>
      <Text size="xs" c="dimmed" ta="center" mt={6}>
        These are the fields you set for every trial in the builder. Results record the key, correctness and reaction time.
      </Text>
    </div>
  )
}

// ─── Chapter 4: workflow ───────────────────────────────────
function WorkflowChapter({ onOpenTemplates, onOpenAi, onPreview, onClose }) {
  const steps = [
    { n: 1, title: 'Start', text: 'Pick a classic template, describe it to the AI, or start blank.', actions: [['Browse templates', onOpenTemplates], ['Generate with AI', onOpenAi]] },
    { n: 2, title: 'Build', text: 'Add Tasks, Decisions and Repeats. Click a Task to edit its trials.' },
    { n: 3, title: 'Preview', text: 'Run it yourself exactly as a participant will. Nothing is recorded.', actions: [['Preview now', onPreview]] },
    { n: 4, title: 'Publish', text: 'Get a public link to share. Participants need no account.' },
    { n: 5, title: 'Results', text: 'Watch sessions arrive: accuracy, reaction times, per-trial data.' },
  ]
  return (
    <div className="hiw-chapter">
      <Text className="hiw-lead">Five steps from idea to data.</Text>
      <ol className="hiw-steps">
        {steps.map((s) => (
          <li key={s.n} className="hiw-step">
            <span className="hiw-step-n">{s.n}</span>
            <div>
              <div className="hiw-step-title">{s.title}</div>
              <div className="hiw-step-text">{s.text}</div>
              {s.actions && (
                <Group gap={8} mt={8}>
                  {s.actions.map(([label, fn]) => (
                    <Button key={label} size="xs" variant="light" onClick={fn}>
                      {label}
                    </Button>
                  ))}
                </Group>
              )}
            </div>
          </li>
        ))}
      </ol>
      <Group justify="center" mt="lg">
        <Button size="md" onClick={onClose}>
          Start building
        </Button>
      </Group>
    </div>
  )
}

// ─── Shell ─────────────────────────────────────────────────
export default function HowItWorksModal({ opened, onClose, onOpenTemplates, onOpenAi, onPreview }) {
  const [chapter, setChapter] = useState(0)
  const last = CHAPTERS.length - 1
  const go = (i) => setChapter(Math.max(0, Math.min(last, i)))

  useEffect(() => {
    if (!opened) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [role="slider"]')) return
      if (e.key === 'ArrowRight') setChapter((c) => Math.min(last, c + 1))
      if (e.key === 'ArrowLeft') setChapter((c) => Math.max(0, c - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [opened, last])

  const body = [
    <PathChapter key="path" />,
    <BlocksChapter key="blocks" />,
    <TrialChapter key="trial" />,
    <WorkflowChapter key="flow" onOpenTemplates={onOpenTemplates} onOpenAi={onOpenAi} onPreview={onPreview} onClose={onClose} />,
  ][chapter]

  return (
    <Modal opened={opened} onClose={onClose} size="90%" radius="xl" padding={0} withCloseButton={false} centered>
      <div className="hiw">
        <nav className="hiw-rail" aria-label="Guide chapters">
          <div className="hiw-rail-title">How it works</div>
          {CHAPTERS.map((c, i) => (
            <button key={c.short} type="button" className={`hiw-rail-item${i === chapter ? ' active' : ''}${i < chapter ? ' done' : ''}`} onClick={() => go(i)}>
              <span className="hiw-rail-n">{i < chapter ? '✓' : i + 1}</span>
              {c.short}
            </button>
          ))}
          <div className="hiw-rail-hint">Tip: use ← → keys</div>
        </nav>
        <section className="hiw-main">
          <header className="hiw-head">
            <div>
              <div className="hiw-kicker">
                Step {chapter + 1} of {CHAPTERS.length}
              </div>
              <h2 className="hiw-title">{CHAPTERS[chapter].title}</h2>
            </div>
            <button type="button" className="hiw-close" onClick={onClose} aria-label="Close guide">
              ✕
            </button>
          </header>
          <div className="hiw-body" key={chapter}>
            {body}
          </div>
          <footer className="hiw-foot">
            <Button variant="subtle" disabled={chapter === 0} onClick={() => go(chapter - 1)}>
              ← Back
            </Button>
            {chapter < last ? (
              <Button onClick={() => go(chapter + 1)}>Next →</Button>
            ) : (
              <Button onClick={onClose}>Done</Button>
            )}
          </footer>
        </section>
      </div>
    </Modal>
  )
}
