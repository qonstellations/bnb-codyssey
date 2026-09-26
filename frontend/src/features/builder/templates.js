import { sampleStroop } from '../../shared/sampleStroop.js'

function trial(id, content, condition, correctKey, extra = {}) {
  return {
    id,
    stimulus: { type: 'text', content, url: null },
    duration: 2000,
    fixationDuration: 500,
    validKeys: ['f', 'j'],
    correctKey,
    condition,
    feedback: { correct: 'Correct!', incorrect: 'Incorrect' },
    itiMs: 500,
    ...extra,
  }
}

const flankerTemplate = {
  settings: {
    consentText: 'You are participating in a study on attention.',
    fullscreen: true,
    showProgressBar: true,
    instructionsText: 'Respond to the direction of the CENTER arrow only. F = left, J = right.',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontSize: 48,
  },
  blocks: [
    {
      id: 'block_main',
      label: 'Main',
      shuffle: true,
      maxRepeats: 2,
      repetitions: 1,
      trials: [
        trial('trial_1', '<<<<<', 'congruent', 'f'),
        trial('trial_2', '>>>>>', 'congruent', 'j'),
        trial('trial_3', '<<><<', 'incongruent', 'j'),
        trial('trial_4', '>><>>', 'incongruent', 'f'),
      ],
    },
  ],
  branches: [],
  loops: [],
}

const simpleRtTemplate = {
  settings: {
    consentText: 'You are participating in a simple reaction time study.',
    fullscreen: true,
    showProgressBar: true,
    instructionsText: 'Press SPACE as soon as you see the circle appear.',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontSize: 48,
  },
  blocks: [
    {
      id: 'block_main',
      label: 'Main',
      shuffle: false,
      maxRepeats: 2,
      repetitions: 5,
      trials: [
        {
          id: 'trial_go',
          stimulus: { type: 'text', content: '●', url: null },
          duration: 1500,
          fixationDuration: 1000,
          validKeys: ['space'],
          correctKey: 'space',
          condition: 'go',
          feedback: { correct: '', incorrect: 'Too slow' },
          itiMs: 800,
        },
      ],
    },
  ],
  branches: [],
  loops: [],
}

export const TEMPLATES = [
  { id: 'stroop', label: 'Stroop', blurb: 'Practice → retry check → Main task', draft: sampleStroop },
  { id: 'flanker', label: 'Flanker', blurb: 'One main task, 4 trials', draft: flankerTemplate },
  { id: 'simple-rt', label: 'Simple reaction time', blurb: 'One signal, repeated 5 times', draft: simpleRtTemplate },
]
