// withhold trial (no-go): not pressing is correct, any press is wrong.
// correctKey null = no right answer (e.g. ratings) → unscored. Unanswered keyed trials stay unscored too.
export function scoreTrial(trial, responded) {
  if (trial.withhold) return !responded
  if (trial.correctKey == null || !responded) return null
  return responded.key === trial.correctKey
}
