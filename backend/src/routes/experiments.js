import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, ownsExperiment, validate } from '../middlewares/index.js';
import {
  getExperiments,
  createExperiment,
  getExperimentById,
  updateExperiment,
  deleteExperiment,
  duplicateExperiment,
  publishExperiment,
} from '../controllers/experiments.controller.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().max(200).optional(),
  draft: z.any().optional(), // e.g. created from a template
});

const updateSchema = z
  .object({
    title: z.string().max(200).optional(),
    draft: z.any().optional(),
    status: z.enum(['draft', 'active', 'closed']).optional(),
  })
  .refine((d) => d.title !== undefined || d.draft !== undefined || d.status !== undefined, {
    message: 'At least one field required',
  });

// ─── Routes ────────────────────────────────────────────────

router.get('/', requireAuth, getExperiments);
router.post('/', requireAuth, validate(createSchema), createExperiment);
router.get('/:id', requireAuth, ownsExperiment, getExperimentById);
router.put('/:id', requireAuth, ownsExperiment, validate(updateSchema), updateExperiment);
router.delete('/:id', requireAuth, ownsExperiment, deleteExperiment);
router.post('/:id/duplicate', requireAuth, ownsExperiment, duplicateExperiment);
router.post('/:id/publish', requireAuth, ownsExperiment, publishExperiment);

export default router;
