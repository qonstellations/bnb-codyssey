import { Router } from 'express';
import { z } from 'zod';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { requireAuth, ownsExperiment, validate } from '../middleware.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const excludeSchema = z.object({
  excluded: z.boolean(),
});

// ─── GET /:experimentId/summary ────────────────────────────
// Aggregated stats: participants, completion rate, mean RT, accuracy.

router.get(
  '/:experimentId/summary',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
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

    const rts = trials.filter((t) => t.rt != null).map((t) => t.rt);
    const meanRt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : 0;

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
            meanRt: Math.round(meanRt * 10) / 10,
            accuracy: Math.round(accuracy * 1000) / 1000,
            meanTimingScore: Math.round(meanTimingScore * 10) / 10,
          },
        },
        'Summary retrieved successfully'
      )
    );
  })
);

// ─── GET /:experimentId/sessions ───────────────────────────
// List sessions with computed trialCount (no trial-level data).

router.get(
  '/:experimentId/sessions',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
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
  })
);

// ─── GET /:experimentId/sessions/:sessionId ────────────────
// Single session + full trial-level data.

router.get(
  '/:experimentId/sessions/:sessionId',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({
      _id: req.params.sessionId,
      experimentId: req.experiment._id,
    });

    if (!session) {
      throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
    }

    const trials = await Trial.find({ sessionId: session._id }).sort({ trialIndex: 1 });
    res.json(new ApiResponse(200, { session, trials }, 'Session retrieved successfully'));
  })
);

// ─── PATCH /:experimentId/sessions/:sessionId ──────────────
// Toggle exclude flag on a session.

router.patch(
  '/:experimentId/sessions/:sessionId',
  requireAuth,
  ownsExperiment,
  validate(excludeSchema),
  asyncHandler(async (req, res) => {
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
  })
);

// ─── GET /:experimentId/export ─────────────────────────────
// Download all data as flat CSV or JSON. One row per trial,
// session fields denormalized.

router.get(
  '/:experimentId/export',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
    const format = req.query.format;
    if (format !== 'csv' && format !== 'json') {
      throw new ApiError(400, 'format query param must be "csv" or "json"', [], '', 'VALIDATION_ERROR');
    }

    const sessions = await Session.find({ experimentId: req.experiment._id });
    const sessionIds = sessions.map((s) => s._id);
    const trials = await Trial.find({ sessionId: { $in: sessionIds } }).sort({
      sessionId: 1,
      trialIndex: 1,
    });

    // Build session lookup
    const sessionMap = Object.fromEntries(sessions.map((s) => [s._id.toString(), s]));

    // Flatten to one row per trial
    const rows = trials.map((t) => {
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
    const title = req.experiment.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const filename = `${title}_${date}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      return res.json(rows);
    }

    // CSV
    const columns = [
      'sessionId',
      'participantId',
      'status',
      'excluded',
      'browser',
      'os',
      'screenW',
      'screenH',
      'pixelRatio',
      'refreshRate',
      'jitter',
      'timingScore',
      'startedAt',
      'completedAt',
      'trialIndex',
      'blockId',
      'condition',
      'stimulusType',
      'stimulusContent',
      'stimulusUrl',
      'response',
      'correct',
      'rt',
      'framesIntended',
      'framesActual',
      'framesDropped',
    ];

    const csvHeader = columns.join(',');
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '';
          let str = String(val);
          // Prevent CSV formula injection (Excel executes =,+,-,@ prefixes)
          if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
          // Quote fields containing commas, quotes, or newlines
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send([csvHeader, ...csvRows].join('\n'));
  })
);

export default router;

