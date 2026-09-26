import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { requireAuth, ownsExperiment, validate } from '../middleware.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const createSchema = z.object({
  title: z.string().max(200).optional(),
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

// ─── Helpers ───────────────────────────────────────────────

function generateSlug() {
  return crypto.randomBytes(4).toString('hex');
}

// ─── GET / ─────────────────────────────────────────────────
// List all experiments owned by the authenticated researcher.

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const experiments = await Experiment.find({ owner: req.userId })
      .select('title status slug createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json(new ApiResponse(200, { experiments }, 'Experiments retrieved successfully'));
  })
);

// ─── POST / ────────────────────────────────────────────────
// Create a new experiment with an empty draft.

router.post(
  '/',
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const experiment = await Experiment.create({
      owner: req.userId,
      title: req.body.title || 'Untitled Experiment',
    });

    res.status(201).json(new ApiResponse(201, { experiment }, 'Experiment created successfully'));
  })
);

// ─── GET /:id ──────────────────────────────────────────────
// Get full experiment (draft + versions).

router.get('/:id', requireAuth, ownsExperiment, (req, res) => {
  res.json(new ApiResponse(200, { experiment: req.experiment }, 'Experiment retrieved successfully'));
});

// ─── PUT /:id ──────────────────────────────────────────────
// Partial update: title, draft, and/or status.

router.put(
  '/:id',
  requireAuth,
  ownsExperiment,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { title, draft, status } = req.body;
    const exp = req.experiment;

    if (title !== undefined) exp.title = title;
    if (draft !== undefined) {
      exp.draft = draft;
      exp.markModified('draft'); // required for Mixed type
    }
    if (status !== undefined) exp.status = status;

    await exp.save();
    res.json(new ApiResponse(200, { experiment: exp }, 'Experiment updated successfully'));
  })
);

// ─── DELETE /:id ───────────────────────────────────────────
// Cascade delete: experiment + all sessions + all trials.

router.delete(
  '/:id',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
    const expId = req.experiment._id;

    // Find all sessions to get their IDs for trial deletion
    const sessions = await Session.find({ experimentId: expId }).select('_id');
    const sessionIds = sessions.map((s) => s._id);

    const trialResult = await Trial.deleteMany({ sessionId: { $in: sessionIds } });
    const sessionResult = await Session.deleteMany({ experimentId: expId });
    await Experiment.findByIdAndDelete(expId);

    res.json(
      new ApiResponse(
        200,
        {
          deleted: {
            experiment: true,
            sessions: sessionResult.deletedCount,
            trials: trialResult.deletedCount,
          },
        },
        'Experiment deleted successfully'
      )
    );
  })
);

// ─── POST /:id/duplicate ──────────────────────────────────
// Deep copy the draft, reset status/slug/versions.

router.post(
  '/:id/duplicate',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
    const source = req.experiment;

    const copy = await Experiment.create({
      owner: req.userId,
      title: `${source.title} (Copy)`,
      draft: JSON.parse(JSON.stringify(source.draft)),
    });

    res.status(201).json(new ApiResponse(201, { experiment: copy }, 'Experiment duplicated successfully'));
  })
);

// ─── POST /:id/publish ────────────────────────────────────
// Freeze draft as a new version, generate slug on first publish.

router.post(
  '/:id/publish',
  requireAuth,
  ownsExperiment,
  asyncHandler(async (req, res) => {
    const exp = req.experiment;

    if (exp.status === 'closed') {
      throw new ApiError(409, 'Cannot publish a closed experiment', [], '', 'CONFLICT');
    }

    const nextVersion = (exp.versions.length || 0) + 1;

    exp.versions.push({
      version: nextVersion,
      snapshot: JSON.parse(JSON.stringify(exp.draft)),
      publishedAt: new Date(),
    });

    if (!exp.slug) {
      exp.slug = generateSlug();
    }

    exp.status = 'active';
    exp.markModified('versions');
    await exp.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    res.json(
      new ApiResponse(
        200,
        {
          version: nextVersion,
          slug: exp.slug,
          participantUrl: `${frontendUrl}/run/${exp.slug}`,
        },
        'Experiment published successfully'
      )
    );
  })
);

export default router;

