import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, ownsExperiment, validate, limit } from '../middlewares/index.js';
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
    // 'active' only via POST /:id/publish, which enforces one live study per user.
    status: z.enum(['draft', 'closed']).optional(),
  })
  .refine((d) => d.title !== undefined || d.draft !== undefined || d.status !== undefined, {
    message: 'At least one field required',
  });

// ─── Routes ────────────────────────────────────────────────

const createLimit = limit('create', 30, '1 h', { by: 'user' });

router.get('/', requireAuth, getExperiments);
router.post('/', requireAuth, createLimit, validate(createSchema), createExperiment);
router.get('/:id', requireAuth, ownsExperiment, getExperimentById);
router.put('/:id', requireAuth, limit('autosave', 120, '1 m', { by: 'user' }), ownsExperiment, validate(updateSchema), updateExperiment);
router.delete('/:id', requireAuth, ownsExperiment, deleteExperiment);
router.post('/:id/duplicate', requireAuth, createLimit, ownsExperiment, duplicateExperiment);
router.post('/:id/publish', requireAuth, limit('publish', 10, '1 h', { by: 'user' }), ownsExperiment, publishExperiment);

export default router;
