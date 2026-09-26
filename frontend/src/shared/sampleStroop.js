// Minimal valid experiment for testing the engine end-to-end.
export const sampleStroop = {
  settings: {
    consentText: 'You are participating in a timing study. Press Start to continue.',
    instructionsText: 'Press F for the left key, J for the right key, matching the word\'s ink color.',
    fullscreen: false,
    showProgressBar: true,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontSize: 48,
  },
  blocks: [
    {
      id: 'block_practice',
      label: 'Practice',
      shuffle: true,
      maxRepeats: 2,
      repetitions: 1,
      trials: [
        {
          id: 'trial_1',
          stimulus: { type: 'text', content: 'RED', url: null },
          duration: 2000,
          fixationDuration: 500,
          validKeys: ['f', 'j'],
          correctKey: 'f',
          timeout: 2000,
          iti: 500,
          condition: 'congruent',
          feedback: { correct: 'Correct!', incorrect: 'Try again' },
        },
        {
          id: 'trial_2',
          stimulus: { type: 'text', content: 'BLUE', url: null },
          duration: 2000,
          fixationDuration: 500,
          validKeys: ['f', 'j'],
          correctKey: 'j',
          timeout: 2000,
          iti: 500,
          condition: 'incongruent',
          feedback: { correct: 'Correct!', incorrect: 'Try again' },
        },
      ],
    },
  ],
  branches: [],
  loops: [],
}
