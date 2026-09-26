import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';
import { hashSessionToken, verifySessionToken } from '../middlewares/sessionToken.middleware.js';

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

export const trialsSchema = z.object({
  trials: z.array(trialItemSchema).min(1).max(500),
});

// ponytail: crypto ids, retry on unique collision if throughput matters
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateCode() {
  return [...crypto.randomBytes(8)].map((b) => CODE_ALPHABET[b % 62]).join('');
}

// Fetch published experiment JSON for timing engine
export const getExperimentBySlug = asyncHandler(async (req, res) => {
  const experiment = await Experiment.findOne({ slug: req.params.slug });

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }
  if (experiment.status === 'closed') {
    throw new ApiError(410, 'This experiment is no longer accepting participants', [], '', 'GONE');
  }

  const latest = experiment.versions[experiment.versions.length - 1];
  const consentText = latest?.snapshot?.settings?.consentText ?? '';
  const consentHash = crypto.createHash('sha256').update(consentText).digest('hex');
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
});

// Start a new participant session
export const startSession = asyncHandler(async (req, res) => {
  const experiment = await Experiment.findOne({ slug: req.params.slug });

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }
  if (experiment.status === 'closed') {
    throw new ApiError(410, 'This experiment is no longer accepting participants', [], '', 'GONE');
  }

  // Only this browser gets the token; later writes to the session must present it.
  const token = crypto.randomBytes(24).toString('hex');
  const latest = experiment.versions[experiment.versions.length - 1];
  const consentText = latest?.snapshot?.settings?.consentText ?? '';
  const consentHash = crypto.createHash('sha256').update(consentText).digest('hex');
  let session;
  for (let i = 0; i < 3; i++) {
    try {
      session = await Session.create({
        experimentId: experiment._id,
        participantId: uuidv4(),
        deviceInfo: req.body.deviceInfo,
        withdrawCode: generateCode(),
        tokenHash: hashSessionToken(token),
        version: latest?.version ?? 0,
        seed: crypto.randomInt(2 ** 31 - 1),
        // The runtime only starts a session after the consent screen's agree click.
        consent: { agreedAt: new Date(), textHash: consentHash },
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
        token,
        seed: session.seed,
      },
      'Session started successfully'
    )
  );
});

// Update calibration or mark as abandoned
export const patchSession = asyncHandler(async (req, res) => {
  const session = req.session; // loaded by requireSessionToken
  if (session.status !== 'in_progress') {
    throw new ApiError(409, `Session is already ${session.status}`, [], '', 'CONFLICT');
  }

  if (req.body.calibration) session.calibration = req.body.calibration;
  if (req.body.status) session.status = req.body.status;
  await session.save();

  res.json(new ApiResponse(200, { ok: true }, 'Session updated successfully'));
});

// Upload a batch of trial data
// Unordered insert; duplicates (a retried batch) are skipped, everything else still lands.
async function insertTrials(session, trials) {
  const docs = trials.map((t) => ({ ...t, sessionId: session._id }));
  try {
    return (await Trial.insertMany(docs, { ordered: false })).length;
  } catch (err) {
    const errors = err?.writeErrors ?? (err?.code === 11000 ? [err] : null);
    if (!errors || errors.some((e) => (e.code ?? e.err?.code) !== 11000)) throw err;
    return err.insertedDocs?.length ?? docs.length - errors.length;
  }
}

// Upload a batch of trial data
export const uploadTrials = asyncHandler(async (req, res) => {
  const session = req.session; // loaded by requireSessionToken
  if (session.status !== 'in_progress') {
    throw new ApiError(409, `Session is already ${session.status}`, [], '', 'CONFLICT');
  }

  const inserted = await insertTrials(session, req.body.trials);
  res.status(201).json(new ApiResponse(201, { inserted }, 'Trials uploaded successfully'));
});

// Mark session as finished
export const completeSession = asyncHandler(async (req, res) => {
  const session = req.session; // loaded by requireSessionToken
  if (session.status !== 'in_progress') {
    throw new ApiError(409, `Session is already ${session.status}`, [], '', 'CONFLICT');
  }

  if (req.body.engagement) session.engagement = req.body.engagement;
  session.status = 'completed';
  session.completedAt = new Date();
  await session.save();

  res.json(new ApiResponse(200, { withdrawCode: session.withdrawCode }, 'Session completed successfully'));
});

// Last-chance save via sendBeacon on tab close
export const beaconSave = async (req, res) => {
  try {
    let data;
    try {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(204).end();
    }

    const session = await Session.findById(req.params.sessionId).select('+tokenHash');
    if (!session || !verifySessionToken(session, data?.token)) return res.status(204).end();
    if (session.status !== 'in_progress') return res.status(204).end();

    // Save any remaining trials (validated — best-effort, drop garbage)
    const parsed = trialsSchema.safeParse({ trials: data.trials ?? [] });
    if (parsed.success && parsed.data.trials.length) {
      await insertTrials(session, parsed.data.trials).catch(() => {});
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
};

// Participant withdraws -> delete session + trials
export const withdrawSession = asyncHandler(async (req, res) => {
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
});
