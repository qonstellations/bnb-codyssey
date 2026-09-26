import Experiment from '../models/Experiment.js';
import { ApiError, asyncHandler } from '../utils/index.js';

// Loads experiment by :id or :experimentId param, verifies the
// authenticated user owns it. Sets req.experiment for the handler.
// Must run AFTER requireAuth.
export const ownsExperiment = asyncHandler(async (req, res, next) => {
  const id = req.params.id || req.params.experimentId;
  let experiment;
  try {
    experiment = await Experiment.findById(id);
  } catch {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }
  if (experiment.owner.toString() !== req.userId) {
    throw new ApiError(403, 'You do not own this experiment', [], '', 'FORBIDDEN');
  }

  req.experiment = experiment;
  next();
});
