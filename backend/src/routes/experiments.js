import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { requireAuth, ownsExperiment, validate } from '../middleware.js';

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

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const experiments = await Experiment.find({ owner: req.userId })
      .select('title status slug createdAt updatedAt')
      .sort({ updatedAt: -1 });

    res.json({ experiments });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ────────────────────────────────────────────────
// Create a new experiment with an empty draft.

router.post('/', requireAuth, validate(createSchema), async (req, res, next) => {
  try {
    const experiment = await Experiment.create({
      owner: req.userId,
      title: req.body.title || 'Untitled Experiment',
    });

    res.status(201).json({ experiment });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id ──────────────────────────────────────────────
// Get full experiment (draft + versions).

router.get('/:id', requireAuth, ownsExperiment, (req, res) => {
  res.json({ experiment: req.experiment });
});

// ─── PUT /:id ──────────────────────────────────────────────
// Partial update: title, draft, and/or status.

router.put('/:id', requireAuth, ownsExperiment, validate(updateSchema), async (req, res, next) => {
  try {
    const { title, draft, status } = req.body;
    const exp = req.experiment;

    if (title !== undefined) exp.title = title;
    if (draft !== undefined) {
      exp.draft = draft;
      exp.markModified('draft'); // required for Mixed type
    }
    if (status !== undefined) exp.status = status;

    await exp.save();
    res.json({ experiment: exp });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ───────────────────────────────────────────
// Cascade delete: experiment + all sessions + all trials.

router.delete('/:id', requireAuth, ownsExperiment, async (req, res, next) => {
  try {
    const expId = req.experiment._id;

    // Find all sessions to get their IDs for trial deletion
    const sessions = await Session.find({ experimentId: expId }).select('_id');
    const sessionIds = sessions.map((s) => s._id);

    const trialResult = await Trial.deleteMany({ sessionId: { $in: sessionIds } });
    const sessionResult = await Session.deleteMany({ experimentId: expId });
    await Experiment.findByIdAndDelete(expId);

    res.json({
      deleted: {
        experiment: true,
        sessions: sessionResult.deletedCount,
        trials: trialResult.deletedCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/duplicate ──────────────────────────────────
// Deep copy the draft, reset status/slug/versions.

router.post('/:id/duplicate', requireAuth, ownsExperiment, async (req, res, next) => {
  try {
    const source = req.experiment;

    const copy = await Experiment.create({
      owner: req.userId,
      title: `${source.title} (Copy)`,
      draft: JSON.parse(JSON.stringify(source.draft)),
    });

    res.status(201).json({ experiment: copy });
  } catch (err) {
    next(err);
  }
});

// ─── POST /:id/publish ────────────────────────────────────
// Freeze draft as a new version, generate slug on first publish.

router.post('/:id/publish', requireAuth, ownsExperiment, async (req, res, next) => {
  try {
    const exp = req.experiment;

    if (exp.status === 'closed') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Cannot publish a closed experiment' },
      });
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

    res.json({
      version: nextVersion,
      slug: exp.slug,
      participantUrl: `${frontendUrl}/run/${exp.slug}`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
