import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, ownsExperiment, validate, requireObjectId } from '../middlewares/index.js';
import {
  getSummary,
  getSessions,
  getSessionById,
  updateSessionStatus,
  exportData,
} from '../controllers/results.controller.js';

const router = Router();

router.param('sessionId', requireObjectId('sessionId', 'Session not found'));

// ─── Schemas ───────────────────────────────────────────────

const excludeSchema = z.object({
  excluded: z.boolean(),
});

// ─── Routes ────────────────────────────────────────────────

router.get('/:experimentId/summary', requireAuth, ownsExperiment, getSummary);
router.get('/:experimentId/sessions', requireAuth, ownsExperiment, getSessions);
router.get('/:experimentId/sessions/:sessionId', requireAuth, ownsExperiment, getSessionById);
router.patch(
  '/:experimentId/sessions/:sessionId',
  requireAuth,
  ownsExperiment,
  validate(excludeSchema),
  updateSessionStatus
);
router.get('/:experimentId/export', requireAuth, ownsExperiment, exportData);

export default router;
