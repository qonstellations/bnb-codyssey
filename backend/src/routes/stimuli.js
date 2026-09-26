import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, requireObjectId } from '../middlewares/index.js';
import {
  getUploadUrl,
  createStimulus,
  getStimuli,
  deleteStimulus,
} from '../controllers/stimuli.controller.js';

const router = Router();

router.param('id', requireObjectId('id', 'Stimulus not found'));

// ─── Schemas ───────────────────────────────────────────────

const uploadUrlSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().refine(
    (ct) => ct.startsWith('image/') || ct.startsWith('audio/') || ct.startsWith('video/'),
    { message: 'Content type must be image/*, audio/*, or video/*' }
  ),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(['image', 'audio', 'video']),
  url: z.string().url().refine((u) => u.includes('.blob.vercel-storage.com'), {
    message: 'URL must be a Vercel Blob URL',
  }),
  size: z.number().int().positive().max(50 * 1024 * 1024),
});

// ─── Routes ────────────────────────────────────────────────

router.post('/upload-url', requireAuth, validate(uploadUrlSchema), getUploadUrl);
router.post('/', requireAuth, validate(createSchema), createStimulus);
router.get('/', requireAuth, getStimuli);
router.delete('/:id', requireAuth, deleteStimulus);

export default router;
