import crypto from 'crypto';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

// ponytail: crypto ids, retry on unique collision if throughput matters
const SLUG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateSlug() {
  return [...crypto.randomBytes(8)].map((b) => SLUG_ALPHABET[b % 62]).join('');
}

// List all experiments owned by the authenticated researcher
export const getExperiments = asyncHandler(async (req, res) => {
  const experiments = await Experiment.find({ owner: req.userId })
    .select('title status slug createdAt updatedAt')
    .sort({ updatedAt: -1 });

  res.json(new ApiResponse(200, { experiments }, 'Experiments retrieved successfully'));
});

// Create a new experiment, empty or from a template draft
export const createExperiment = asyncHandler(async (req, res) => {
  const experiment = await Experiment.create({
    owner: req.userId,
    title: req.body.title || 'Untitled Experiment',
    ...(req.body.draft && { draft: req.body.draft }),
  });

  res.status(201).json(new ApiResponse(201, { experiment }, 'Experiment created successfully'));
});

// Get full experiment (draft + versions)
export const getExperimentById = (req, res) => {
  res.json(new ApiResponse(200, { experiment: req.experiment }, 'Experiment retrieved successfully'));
};

// Partial update: title, draft, and/or status
export const updateExperiment = asyncHandler(async (req, res) => {
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
});

// Cascade delete: experiment + all sessions + all trials
export const deleteExperiment = asyncHandler(async (req, res) => {
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
});

// Deep copy the draft, reset status/slug/versions
export const duplicateExperiment = asyncHandler(async (req, res) => {
  const source = req.experiment;

  const copy = await Experiment.create({
    owner: req.userId,
    title: `${source.title} (Copy)`,
    draft: JSON.parse(JSON.stringify(source.draft ?? {})),
  });

  res.status(201).json(new ApiResponse(201, { experiment: copy }, 'Experiment duplicated successfully'));
});

// Freeze draft as a new version, generate slug on first publish
export const publishExperiment = asyncHandler(async (req, res) => {
  const exp = req.experiment;

  if (exp.status === 'closed') {
    throw new ApiError(409, 'Cannot publish a closed experiment', [], '', 'CONFLICT');
  }

  const nextVersion = (exp.versions.length || 0) + 1;

  exp.versions.push({
    version: nextVersion,
    snapshot: JSON.parse(JSON.stringify(exp.draft ?? {})),
    publishedAt: new Date(),
  });

  exp.status = 'active';
  exp.markModified('versions');

  if (!exp.slug) {
    // Retry on slug collision (unique index) instead of 500ing
    for (let i = 0; i < 3 && !exp.slug; i++) {
      exp.slug = generateSlug();
      try {
        await exp.save();
      } catch (err) {
        if (err?.code === 11000) exp.slug = null;
        else throw err;
      }
    }
    if (!exp.slug) {
      throw new ApiError(500, 'Could not generate unique slug', [], '', 'INTERNAL_ERROR');
    }
  } else {
    await exp.save();
  }

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
});
