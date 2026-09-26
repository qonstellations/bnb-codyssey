import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const round = (v, dp) => (v == null ? '' : Math.round(v * 10 ** dp) / 10 ** dp);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// RT stats over correct responses only — errors, no-go presses and too-early presses would
// otherwise pull the mean around. sd is the sample SD (n-1); null when it can't be computed.
function rtStats(trials) {
  const rts = trials.filter((t) => t.rt != null && t.correct === true).map((t) => t.rt);
  const n = rts.length;
  const mean = n ? rts.reduce((a, b) => a + b, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(rts.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, median: median(rts), sd, sem: sd == null ? null : sd / Math.sqrt(n) };
}

// Aggregated stats: participants, completion rate, mean RT, accuracy
export const getSummary = asyncHandler(async (req, res) => {
  const expId = req.experiment._id;

  const sessions = await Session.find({ experimentId: expId });
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const abandoned = sessions.filter((s) => s.status === 'abandoned').length;
  const excluded = sessions.filter((s) => s.excluded).length;

  // Compute RT + accuracy from non-excluded, completed sessions
  const validSessions = sessions.filter((s) => s.status === 'completed' && !s.excluded);
  const validSessionIds = validSessions.map((s) => s._id);

  const trials = validSessionIds.length
    ? await Trial.find({ sessionId: { $in: validSessionIds } })
    : [];

  const rt = rtStats(trials);

  const scored = trials.filter((t) => t.correct !== null);
  const accuracy = scored.length
    ? scored.filter((t) => t.correct).length / scored.length
    : 0;

  const scores = validSessions
    .filter((s) => s.calibration?.score != null)
    .map((s) => s.calibration.score);
  const meanTimingScore = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  res.json(
    new ApiResponse(
      200,
      {
        summary: {
          totalSessions: total,
          completed,
          abandoned,
          excluded,
          completionRate: total ? Math.round((completed / total) * 1000) / 1000 : 0,
          meanRt: Math.round((rt.mean ?? 0) * 10) / 10,
          medianRt: rt.median == null ? null : Math.round(rt.median * 10) / 10,
          sdRt: rt.sd == null ? null : Math.round(rt.sd * 10) / 10,
          semRt: rt.sem == null ? null : Math.round(rt.sem * 10) / 10,
          nRt: rt.n,
          accuracy: Math.round(accuracy * 1000) / 1000,
          meanTimingScore: Math.round(meanTimingScore * 10) / 10,
        },
      },
      'Summary retrieved successfully'
    )
  );
});

// List sessions with computed trialCount (no trial-level data)
export const getSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ experimentId: req.experiment._id });
  const sessionIds = sessions.map((s) => s._id);

  // Aggregate trial counts in one query
  const counts = await Trial.aggregate([
    { $match: { sessionId: { $in: sessionIds } } },
    { $group: { _id: '$sessionId', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(
    counts.map((c) => [c._id.toString(), c.count])
  );

  const result = sessions.map((s) => ({
    ...s.toObject(),
    trialCount: countMap[s._id.toString()] || 0,
  }));

  res.json(new ApiResponse(200, { sessions: result }, 'Sessions retrieved successfully'));
});

// Single session + full trial-level data
export const getSessionById = asyncHandler(async (req, res) => {
  const session = await Session.findOne({
    _id: req.params.sessionId,
    experimentId: req.experiment._id,
  });

  if (!session) {
    throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
  }

  const trials = await Trial.find({ sessionId: session._id }).sort({ trialIndex: 1 });
  res.json(new ApiResponse(200, { session, trials }, 'Session retrieved successfully'));
});

// Toggle exclude flag on a session
export const updateSessionStatus = asyncHandler(async (req, res) => {
  const session = await Session.findOneAndUpdate(
    { _id: req.params.sessionId, experimentId: req.experiment._id },
    { excluded: req.body.excluded },
    { new: true }
  );

  if (!session) {
    throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
  }

  res.json(
    new ApiResponse(
      200,
      { session: { _id: session._id, excluded: session.excluded } },
      'Session updated successfully'
    )
  );
});

const TRIAL_COLUMNS = [
  'sessionId', 'participantId', 'status', 'excluded', 'browser', 'os', 'screenW', 'screenH',
  'pixelRatio', 'refreshRate', 'jitter', 'timingScore', 'version', 'seed', 'tabSwitches',
  'blurCount', 'fullscreenExits', 'startedAt', 'completedAt', 'trialIndex', 'blockId',
  'condition', 'stimulusType', 'stimulusContent', 'stimulusUrl', 'response', 'correct', 'rt',
  'framesIntended', 'framesActual', 'framesDropped',
];
const SESSION_COLUMNS = [
  'sessionId', 'participantId', 'status', 'excluded', 'blockId', 'trials', 'scoredTrials',
  'accuracy', 'meanRt', 'medianRt', 'sdRt', 'timingScore', 'startedAt', 'completedAt', 'durationSec',
  'consentAt', 'consentHash',
];


// One row per session per block, plus an overall row (blockId "all") per session.
function sessionSummaryRows(sessions, trials) {
  const bySession = new Map(sessions.map((s) => [s._id.toString(), []]));
  for (const t of trials) bySession.get(t.sessionId.toString())?.push(t);
  return sessions.flatMap((s) => {
    const ts = bySession.get(s._id.toString());
    const blocks = new Map();
    for (const t of ts) blocks.set(t.blockId, [...(blocks.get(t.blockId) ?? []), t]);
    const groups = [['all', ts], ...blocks];
    return groups.map(([blockId, group]) => {
      const rt = rtStats(group);
      const scored = group.filter((t) => t.correct != null);
      return {
        sessionId: s._id.toString(),
        participantId: s.participantId,
        status: s.status,
        excluded: s.excluded,
        blockId,
        trials: group.length,
        scoredTrials: scored.length,
        accuracy: scored.length ? round(scored.filter((t) => t.correct).length / scored.length, 3) : '',
        meanRt: round(rt.mean, 1),
        medianRt: round(rt.median, 1),
        sdRt: round(rt.sd, 1),
        timingScore: s.calibration?.score ?? '',
        startedAt: s.startedAt?.toISOString() ?? '',
        completedAt: s.completedAt?.toISOString() ?? '',
        durationSec: s.startedAt && s.completedAt ? round((s.completedAt - s.startedAt) / 1000, 1) : '',
        consentAt: s.consent?.agreedAt?.toISOString() ?? '',
        consentHash: s.consent?.textHash ?? '',
      };
    });
  });
}

function toCsv(rows, columns) {
  const cell = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    // Prevent CSV formula injection (Excel executes =,+,-,@ prefixes)
    if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
    // Quote fields containing commas, quotes, or newlines
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [columns.join(','), ...rows.map((row) => columns.map((c) => cell(row[c])).join(','))].join('\n');
}

// Download data as CSV or JSON: trial rows (kind=trials) or per-session/block summary
// (kind=sessions); scope=clean keeps only completed, non-excluded sessions.
export const exportData = asyncHandler(async (req, res) => {
  const { format, kind = 'trials', scope = 'all' } = req.query;
  if (format !== 'csv' && format !== 'json') {
    throw new ApiError(400, 'format query param must be "csv" or "json"', [], '', 'VALIDATION_ERROR');
  }
  if (kind !== 'trials' && kind !== 'sessions') {
    throw new ApiError(400, 'kind query param must be "trials" or "sessions"', [], '', 'VALIDATION_ERROR');
  }
  if (scope !== 'all' && scope !== 'clean') {
    throw new ApiError(400, 'scope query param must be "all" or "clean"', [], '', 'VALIDATION_ERROR');
  }

  const sessions = await Session.find({
    experimentId: req.experiment._id,
    ...(scope === 'clean' && { status: 'completed', excluded: { $ne: true } }),
  }).sort({ startedAt: 1 });
  const sessionIds = sessions.map((s) => s._id);
  const trials = await Trial.find({ sessionId: { $in: sessionIds } }).sort({
    sessionId: 1,
    trialIndex: 1,
  });

  // Build session lookup
  const sessionMap = Object.fromEntries(sessions.map((s) => [s._id.toString(), s]));

  // Flatten to one row per trial
  const rows = kind === 'sessions' ? sessionSummaryRows(sessions, trials) : trials.map((t) => {
    const s = sessionMap[t.sessionId.toString()];
    return {
      sessionId: s._id.toString(),
      participantId: s.participantId,
      status: s.status,
      excluded: s.excluded,
      browser: s.deviceInfo?.browser ?? '',
      os: s.deviceInfo?.os ?? '',
      screenW: s.deviceInfo?.screenW ?? '',
      screenH: s.deviceInfo?.screenH ?? '',
      pixelRatio: s.deviceInfo?.pixelRatio ?? '',
      refreshRate: s.calibration?.refreshRate ?? '',
      jitter: s.calibration?.jitter ?? '',
      timingScore: s.calibration?.score ?? '',
      version: s.version ?? '',
      seed: s.seed ?? '',
      tabSwitches: s.engagement?.tabSwitches ?? '',
      blurCount: s.engagement?.blurCount ?? '',
      fullscreenExits: s.engagement?.fullscreenExits ?? '',
      startedAt: s.startedAt?.toISOString() ?? '',
      completedAt: s.completedAt?.toISOString() ?? '',
      trialIndex: t.trialIndex,
      blockId: t.blockId,
      condition: t.condition,
      stimulusType: t.stimulus?.type ?? '',
      stimulusContent: t.stimulus?.content ?? '',
      stimulusUrl: t.stimulus?.url ?? '',
      response: t.response ?? '',
      correct: t.correct,
      rt: t.rt,
      framesIntended: t.frameData?.intended ?? '',
      framesActual: t.frameData?.actual ?? '',
      framesDropped: t.frameData?.dropped ?? '',
    };
  });

  // Generate filename
  const title = req.experiment.title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'experiment';
  const date = new Date().toISOString().split('T')[0];
  const filename = `${title}_${kind}${scope === 'clean' ? '_clean' : ''}_${date}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.json(rows);
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  // BOM so Excel reads UTF-8 stimuli (accents, non-Latin words) correctly.
  res.send('﻿' + toCsv(rows, kind === 'sessions' ? SESSION_COLUMNS : TRIAL_COLUMNS));
});
