import { Router } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { rateLimit, validate } from '../middleware.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const createSessionSchema = z.object({
  deviceInfo: z.object({
    browser: z.string().max(100),
    os: z.string().max(100),
    screenW: z.number().int().positive(),
    screenH: z.number().int().positive(),
    pixelRatio: z.number().positive(),
  }),
});

const patchSessionSchema = z
  .object({
    calibration: z
      .object({
        refreshRate: z.number().positive(),
        jitter: z.number().min(0),
        score: z.number().min(0).max(100),
      })
      .optional(),
    status: z.enum(['abandoned']).optional(),
  })
  .refine((d) => d.calibration || d.status, {
    message: 'At least one field required',
  });

const trialItemSchema = z.object({
  trialIndex: z.number().int().min(0),
  blockId: z.string().max(100),
  condition: z.string().max(100),
  stimulus: z.object({
    type: z.enum(['text', 'image', 'audio']),
    content: z.string().max(1000).nullable().optional(),
    url: z.string().url().nullable().optional(),
  }),
  response: z.string().max(50).nullable().optional(),
  correct: z.boolean().nullable().optional(),
  rt: z.number().min(0).nullable().optional(),
  frameData: z.object({
    intended: z.number().int().min(0),
    actual: z.number().int().min(0),
    dropped: z.number().int().min(0),
  }),
});

const trialsSchema = z.object({
  trials: z.array(trialItemSchema).min(1).max(500),
});

// ─── Helpers ───────────────────────────────────────────────

// ponytail: crypto ids, retry on unique collision if throughput matters
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateCode() {
  return [...crypto.randomBytes(8)].map((b) => CODE_ALPHABET[b % 62]).join('');
}

// ─── GET /:slug ────────────────────────────────────────────
// Fetch published experiment JSON for the timing engine.

router.get(
  '/:slug',
  rateLimit,
  asyncHandler(async (req, res) => {
    const experiment = await Experiment.findOne({ slug: req.params.slug });

    if (!experiment) {
      throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
    }
    if (experiment.status === 'closed') {
      throw new ApiError(410, 'This experiment is no longer accepting participants', [], '', 'GONE');
    }

    const latest = experiment.versions[experiment.versions.length - 1];
    res.json(
      new ApiResponse(
        200,
        {
          experiment: {
            _id: experiment._id,
            title: experiment.title,
            version: latest?.version ?? 0,
            snapshot: latest?.snapshot ?? {},
          },
        },
        'Experiment fetched successfully'
      )
    );
  })
);

// ─── POST /:slug/sessions ──────────────────────────────────
// Start a new participant session.

router.post(
  '/:slug/sessions',
  rateLimit,
  validate(createSessionSchema),
  asyncHandler(async (req, res) => {
    const experiment = await Experiment.findOne({ slug: req.params.slug });

    if (!experiment) {
      throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
    }
    if (experiment.status === 'closed') {
      throw new ApiError(410, 'This experiment is no longer accepting participants', [], '', 'GONE');
    }

    let session;
    for (let i = 0; i < 3; i++) {
      try {
        session = await Session.create({
          experimentId: experiment._id,
          participantId: uuidv4(),
          deviceInfo: req.body.deviceInfo,
          withdrawCode: generateCode(),
        });
        break;
      } catch (err) {
        if (err?.code !== 11000 || i === 2) throw err;
      }
    }

    res.status(201).json(
      new ApiResponse(
        201,
        {
          sessionId: session._id,
          withdrawCode: session.withdrawCode,
        },
        'Session started successfully'
      )
    );
  })
);

// ─── PATCH /sessions/:sessionId ────────────────────────────
// Update calibration or mark as abandoned. Only while in_progress.

router.patch(
  '/sessions/:sessionId',
  rateLimit,
  validate(patchSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
    }
    if (session.status !== 'in_progress') {
      throw new ApiError(409, `Session is already ${session.status}`, [], '', 'CONFLICT');
    }

    if (req.body.calibration) session.calibration = req.body.calibration;
    if (req.body.status) session.status = req.body.status;
    await session.save();

    res.json(new ApiResponse(200, { ok: true }, 'Session updated successfully'));
  })
);

// ─── POST /sessions/:sessionId/trials ──────────────────────
// Upload a batch of trial data (called between blocks).

router.post(
  '/sessions/:sessionId/trials',
  rateLimit,
  validate(trialsSchema),
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
    }
    if (session.status !== 'in_progress') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: `Session is already ${session.status}` },
      });
    }

    const docs = req.body.trials.map((t) => ({ ...t, sessionId: session._id }));
    const result = await Trial.insertMany(docs);

    res.status(201).json(new ApiResponse(201, { inserted: result.length }, 'Trials uploaded successfully'));
  })
);

// ─── POST /sessions/:sessionId/complete ────────────────────
// Mark session as finished, return withdraw code for display.

router.post(
  '/sessions/:sessionId/complete',
  rateLimit,
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.sessionId);

    if (!session) {
      throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
    }
    if (session.status !== 'in_progress') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: `Session is already ${session.status}` },
      });
    }

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    res.json(new ApiResponse(200, { withdrawCode: session.withdrawCode }, 'Session completed successfully'));
  })
);

// ─── POST /sessions/:sessionId/beacon ──────────────────────
// Last-chance save via sendBeacon on tab close.
// Accepts text/plain, best-effort (always returns 204).

router.post('/sessions/:sessionId/beacon', rateLimit, async (req, res) => {
  try {
    let data;
    try {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(204).end();
    }

    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(204).end();
    if (session.status !== 'in_progress') return res.status(204).end();

    // Save any remaining trials (validated — best-effort, drop garbage)
    const parsed = trialsSchema.safeParse({ trials: data.trials ?? [] });
    if (parsed.success && parsed.data.trials.length) {
      const docs = parsed.data.trials.map((t) => ({ ...t, sessionId: session._id }));
      await Trial.insertMany(docs, { ordered: false }).catch(() => {});
    }

    // Mark as abandoned if still in progress
    if (data.status === 'abandoned' && session.status === 'in_progress') {
      session.status = 'abandoned';
      await session.save();
    }
  } catch {
    // swallow all errors — best-effort
  }
  res.status(204).end();
});

// ─── DELETE /withdraw/:withdrawCode ────────────────────────
// Participant withdraws → delete session + all its trials.

router.delete(
  '/withdraw/:withdrawCode',
  rateLimit,
  asyncHandler(async (req, res) => {
    const session = await Session.findOne({ withdrawCode: req.params.withdrawCode });

    if (!session) {
      throw new ApiError(404, 'Invalid withdraw code', [], '', 'NOT_FOUND');
    }

    const trialResult = await Trial.deleteMany({ sessionId: session._id });
    await Session.findByIdAndDelete(session._id);

    res.json(
      new ApiResponse(
        200,
        {
          deleted: { sessions: 1, trials: trialResult.deletedCount },
        },
        'Session withdrawn successfully'
      )
    );
  })
);

export default router;

