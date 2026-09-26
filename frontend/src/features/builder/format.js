// User-facing wording helpers. Internal types/fields/APIs are untouched —
// these only change what researchers read.

export function estTimeText(trials) {
  const ms = (trials ?? []).reduce(
    (sum, t) => sum + (t.duration ?? 0) + (t.fixationDuration ?? 0) + (t.itiMs ?? 0),
    0
  );
  if (!ms) return null;
  const mins = ms / 60000;
  if (mins < 1) return `~${Math.max(1, Math.round(ms / 1000))} sec`;
  return `~${mins < 10 ? mins.toFixed(1).replace(/\.0$/, '') : Math.round(mins)} min`;
}

const METRIC_TEXT = {
  accuracy: 'accuracy',
  meanRt: 'avg. response time',
  completionRate: 'completion rate',
};

const OPERATOR_TEXT = {
  '<': 'below',
  '<=': 'at most',
  '>': 'above',
  '>=': 'at least',
  '==': 'exactly',
  '!=': 'not',
};

export function isPercentMetric(metric) {
  return metric === 'accuracy' || metric === 'completionRate';
}

export function valueText(condition) {
  if (!condition) return '';
  if (isPercentMetric(condition.metric)) return `${Math.round(condition.value * 100)}%`;
  return `${condition.value}ms`;
}

// "accuracy below 70%" — for edge labels and summaries.
export function conditionText(condition) {
  if (!condition) return 'no condition set';
  const metric = METRIC_TEXT[condition.metric] ?? condition.metric;
  const op = OPERATOR_TEXT[condition.operator] ?? condition.operator;
  return `${metric} ${op} ${valueText(condition)}`;
}

const BLOCK_LABEL = /blocks\.(\d+)/;

// Technical Zod messages -> plain English. `blocks` is the compiled array
// (for resolving labels); falls back to the original message when unknown.
export function friendlyError(issue, blocks = []) {
  const m = issue.message ?? '';
  const path = Array.isArray(issue.path) ? issue.path.join('.') : (issue.path ?? '');

  if (/needs at least 1 trial/.test(m)) {
    const i = Number(BLOCK_LABEL.exec(path)?.[1]);
    const label = Number.isFinite(i) && blocks[i] ? blocks[i].label : 'A step';
    return `'${label}' has no trials yet. Click it and add a trial.`;
  }
  if (/consentText/.test(m)) return 'Add a consent text under Experiment settings (right panel).';
  if (/text stimulus needs/.test(m)) return 'A trial is missing its text. Open the step and fill in the content.';
  if (/needs 'url'/.test(m)) return 'An image/audio trial is missing its file. Open the step and pick one.';
  if (/correctKey/.test(m)) {
    const trial = /trial '([^']+)'/.exec(m)?.[1];
    const owner = trial ? blocks.find((b) => b.trials?.some((t) => t.id === trial)) : null;
    return owner
      ? `A trial in '${owner.label}' has a correct key that isn't one of its valid keys.`
      : 'A trial has a correct key that isn\'t one of its valid keys.';
  }
  if (/branch.*unknown block/.test(m)) return 'A Decision points to a deleted step. Reconnect it on the canvas.';
  if (/loop.*unknown block/.test(m)) return 'A Repeat points to a deleted step. Reconnect it on the canvas.';
  if (/branch/.test(m) && /required|invalid/.test(m)) return 'A Decision is missing its condition. Click it to set one.';
  return m || 'Something in the experiment needs attention.';
}
