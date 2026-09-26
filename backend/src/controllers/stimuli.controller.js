import { del } from '@vercel/blob';
import Stimulus from '../models/Stimulus.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

// Generate a Vercel Blob client upload token
export const getUploadUrl = asyncHandler(async (req, res) => {
  const { handleUpload } = await import('@vercel/blob/client');

  // The SDK's handleUpload speaks client events, not our {filename, contentType}
  // contract — synthesize the generate-token event so API.md keeps its shape.
  const jsonResponse = await handleUpload({
    body: {
      type: 'blob.generate-client-token',
      payload: { pathname: req.body.filename },
    },
    request: req,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [req.body.contentType],
      maximumSizeInBytes: 50 * 1024 * 1024, // 50 MB
    }),
    onUploadCompleted: async () => {
      // Could auto-create stimulus record here in the future
    },
  });

  res.json(new ApiResponse(200, jsonResponse, 'Upload URL generated successfully'));
});

// Save a stimulus metadata record after client-side upload
export const createStimulus = asyncHandler(async (req, res) => {
  const stimulus = await Stimulus.create({
    owner: req.userId,
    ...req.body,
  });

  res.status(201).json(new ApiResponse(201, { stimulus }, 'Stimulus created successfully'));
});

// List all stimuli owned by authenticated researcher
export const getStimuli = asyncHandler(async (req, res) => {
  const stimuli = await Stimulus.find({ owner: req.userId }).sort({ createdAt: -1 });
  res.json(new ApiResponse(200, { stimuli }, 'Stimuli retrieved successfully'));
});

// Delete stimulus record + file from Vercel Blob
export const deleteStimulus = asyncHandler(async (req, res) => {
  const stimulus = await Stimulus.findById(req.params.id);

  if (!stimulus) {
    throw new ApiError(404, 'Stimulus not found', [], '', 'NOT_FOUND');
  }
  if (stimulus.owner.toString() !== req.userId) {
    throw new ApiError(403, 'You do not own this stimulus', [], '', 'FORBIDDEN');
  }

  // Delete from Vercel Blob (non-fatal if it fails)
  try {
    await del(stimulus.url);
  } catch {
    // Blob deletion failure is non-fatal
  }

  await Stimulus.findByIdAndDelete(stimulus._id);
  res.json(new ApiResponse(200, { deleted: true }, 'Stimulus deleted successfully'));
});
