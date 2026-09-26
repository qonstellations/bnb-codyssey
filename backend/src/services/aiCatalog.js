// The complete set of building blocks the Codyssey builder + runtime support.
// The AI is told to design STRICTLY within these; anything else gets
// approximated and reported in "notes". Keep in sync with
// frontend/src/engine (runtime), frontend/src/features/builder (canvas) and
// frontend/src/shared/templates (paradigm library).

// Response keys the runtime can match (it compares event.key.toLowerCase()).
export const NAMED_KEYS = [' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'enter', 'click'];
export const KEY_ALIASES = {
  space: ' ', spacebar: ' ', 'space bar': ' ',
  left: 'arrowleft', right: 'arrowright', up: 'arrowup', down: 'arrowdown',
  return: 'enter', mouse: 'click', 'mouse click': 'click',
};

export const COMPONENTS = `AVAILABLE COMPONENTS — use ONLY these. Nothing else exists in the builder or runtime.

CANVAS NODES (the flow the researcher sees):
- Start → … → End: fixed; blocks are chained between them in array order.
- Block: an ordered set of trials. Fields: id, label, shuffle (randomise trial order), maxRepeats (max same-condition trials in a row when shuffled, 1-20), repetitions (run the whole trial list N times, reshuffled each time, 1-100), trials[].
- Branch: after block "from" finishes, if condition is true jump to block "to" (same block = repeat it; earlier block = go back). Otherwise continue to the next block. Condition = { metric, operator, value } with metric "accuracy" (0-1), "meanRt" (ms) or "completionRate" (0-1); operator < <= > >= == !=. Max ONE branch per "from" block.
- Loop: repeats one block N times in place (2-100) before moving on.

TRIAL (one screen = fixation → stimulus → response → optional feedback → ITI):
- fixationDuration: "+" shown before the stimulus, 0-10000 ms (0 = none).
- stimulus: { "type": "text", "content": string, "color": optional hex ink colour }.
    content ≤ 1000 chars, any unicode (arrows ← → ↑ ↓, symbols ● ■ ▲, emoji), "\\n" for line breaks (e.g. grids, category reminders). Always centred on screen.
    color overrides settings.textColor for this trial only (use for Stroop ink colours etc.).
- duration: how long the stimulus shows AND the response window, 1-60000 ms. timeoutMs (optional) can set a different response window.
- validKeys: 1-10 keys. Allowed: single lowercase characters ("f", "j", "e", "i", "1", "z"…), " " (SPACE — never "space"), "arrowleft", "arrowright", "arrowup", "arrowdown", "enter", "click" (mouse click anywhere).
- correctKey: one of validKeys, or null when there is no right answer (ratings, preferences) — then the trial is recorded but not scored.
- withhold: true on no-go trials — NOT pressing is scored correct, any press is wrong (set correctKey null).
- condition: free-text label used to group results (e.g. "congruent", "nogo", "target").
- feedback: optional { "correct": text, "incorrect": text } shown 600 ms after the response — use in practice blocks.
- itiMs: optional blank gap after the trial, 0-10000 ms.
Only ONE stimulus per trial: no cue-then-target sequences, no positions (left/right of screen), no moving or simultaneous stimuli. Image/audio stimuli need researcher uploads — never use them; use text.

SETTINGS (whole experiment): consentText (required), instructionsText (shown once at start — must state the keys), fullscreen, showProgressBar, backgroundColor, textColor, fontSize (8-72).

PARADIGM RECIPES (the built-in template library — reuse these patterns):
- Simple RT: "●", validKeys [" "], correctKey " ", vary fixationDuration 600-1400 ms for a variable foreperiod.
- Choice RT: "←"/"→", keys f/j.
- Stroop: colour words with "color" set to the ink; keys r/g/b/y = ink colour; congruent (word = ink) vs incongruent.
- Flanker: "<<<<<", ">>>>>", ">><>>", "<<><<"; keys f (left) / j (right) for the MIDDLE arrow.
- Go/No-Go: go "O" correctKey " ", no-go "X" correctKey null + withhold true, validKeys [" "], ~25% no-go, short duration (~800 ms).
- Ratings / Likert: show the item as text with the scale in the content (e.g. "…

1 = not at all … 7 = very"), validKeys "1".."7", correctKey null.
- Lexical decision: real words vs pronounceable non-words; f = word, j = non-word.
- N-back: letter stream with shuffle:false; j = matches the letter N back, f = otherwise; ~30% targets.
- Task switching: put the task cue in the text ("ODD or EVEN?\\n\\n7"); pure blocks then a mixed block.
- Visual search: grid of "T" with/without one "L" using spaces and "\\n"; j = present, f = absent; vary set size.
- IAT: header line "E: A          I: B" + "\\n\\n\\n" + word; keys e/i; 5 blocks (targets, attributes, compatible, reversed targets, incompatible).
- Practice pattern: short practice block with feedback + branch { from: practice, to: practice, accuracy < 0.7 } to repeat it.

If the researcher asks for something outside these components (images, audio, sliders, questionnaires, positions, cue-target timing, free-text answers…), build the closest possible version from the components above and explain the approximation in "notes".`;

// Short version for the clarify step — it only needs to know what is possible, not every field.
export const CAPABILITIES = `The builder supports ONLY: text stimuli (any unicode, emoji, line breaks, optional per-trial ink colour), one stimulus per trial with optional fixation, keyboard keys (single characters, space, arrow keys, enter) or mouse click as responses, correct/incorrect or unscored (rating) or withhold (no-go) trials, practice feedback, blocks with shuffling/repetitions, branches on accuracy/meanRt/completionRate, and loops. No images, audio, sliders, questionnaires, screen positions or cue→target sequences.`;
