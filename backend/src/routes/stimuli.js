import { Router } from 'express';
import { z } from 'zod';
import { del } from '@vercel/blob';
import Stimulus from '../models/Stimulus.js';
import { requireAuth, validate } from '../middleware.js';

const router = Router();

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

// ─── POST /upload-url ──────────────────────────────────────
// Generate a Vercel Blob client upload token.
// The frontend uses this to upload files directly to Blob storage.

router.post('/upload-url', requireAuth, validate(uploadUrlSchema), async (req, res, next) => {
  try {
    const { handleUpload } = await import('@vercel/blob/client');

    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [req.body.contentType],
        maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB
      }),
      onUploadCompleted: async () => {
        // Could auto-create stimulus record here in the future
      },
    });

    res.json(jsonResponse);
  } catch (err) {
    next(err);
  }
});

// ─── POST / ────────────────────────────────────────────────
// Save a stimulus metadata record after the client-side upload.

router.post('/', requireAuth, validate(createSchema), async (req, res, next) => {
  try {
    const stimulus = await Stimulus.create({
      owner: req.userId,
      ...req.body,
    });

    res.status(201).json({ stimulus });
  } catch (err) {
    next(err);
  }
});

// ─── GET / ─────────────────────────────────────────────────
// List all stimuli owned by the authenticated researcher.

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const stimuli = await Stimulus.find({ owner: req.userId }).sort({ createdAt: -1 });
    res.json({ stimuli });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ───────────────────────────────────────────
// Delete stimulus record + file from Vercel Blob.

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const stimulus = await Stimulus.findById(req.params.id);

    if (!stimulus) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Stimulus not found' },
      });
    }
    if (stimulus.owner.toString() !== req.userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not own this stimulus' },
      });
    }

    // Delete from Vercel Blob (non-fatal if it fails)
    try {
      await del(stimulus.url);
    } catch {
      // Blob deletion failure is non-fatal
    }

    await Stimulus.findByIdAndDelete(stimulus._id);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
