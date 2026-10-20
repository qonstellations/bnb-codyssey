import { Router } from 'express';
import { z } from 'zod';
import { rateLimit, limit, validate, requireObjectId, requireSessionToken } from '../middlewares/index.js';
import {
  getExperimentBySlug,
  startSession,
  patchSession,
  uploadTrials,
  completeSession,
  beaconSave,
  withdrawSession,
  trialsSchema,
} from '../controllers/run.controller.js';

const router = Router();

router.param('sessionId', requireObjectId('sessionId', 'Session not found'));

// ─── Schemas ───────────────────────────────────────────────

const createSessionSchema = z.object({
  deviceInfo: z.object({
    browser: z.string().max(100),
    os: z.string().max(100),
    screenW: z.number().int().positive(),
    screenH: z.number().int().positive(),
    pixelRatio: z.number().positive(),
  }),
  // Recruitment-panel id (Prolific etc.); only stored when the study opts in.
  externalId: z.string().regex(/^[\w.-]{1,64}$/).optional(),
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

const count = z.number().int().min(0).max(100000);
const completeSessionSchema = z.object({
  engagement: z
    .object({ tabSwitches: count, blurCount: count, fullscreenExits: count })
    .optional(),
});

// ─── Routes ────────────────────────────────────────────────
// Session writes check the token first: validate() strips unknown keys like `token`.

router.get('/:slug', rateLimit, getExperimentBySlug);
router.post('/:slug/sessions', rateLimit, limit('session-start', 10, '1 h'), validate(createSessionSchema), startSession);
router.patch('/sessions/:sessionId', rateLimit, requireSessionToken, validate(patchSessionSchema), patchSession);
router.post('/sessions/:sessionId/trials', rateLimit, requireSessionToken, validate(trialsSchema), uploadTrials);
router.post('/sessions/:sessionId/complete', rateLimit, requireSessionToken, validate(completeSessionSchema), completeSession);
router.post('/sessions/:sessionId/beacon', rateLimit, beaconSave);
router.delete('/withdraw/:withdrawCode', rateLimit, withdrawSession);

export default router;
