import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { del } from '@vercel/blob';
import User from '../models/User.js';
import Experiment from '../models/Experiment.js';
import Session from '../models/Session.js';
import Trial from '../models/Trial.js';
import Template from '../models/Template.js';
import Stimulus from '../models/Stimulus.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'Email already registered', [], '', 'CONFLICT');
  }

  const user = await User.create({ name, email, password });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = hashToken(refreshToken);
  await user.save();

  res.status(201).json(
    new ApiResponse(
      201,
      { user: user.toSafeJSON(), accessToken, refreshToken },
      'User registered successfully'
    )
  );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, 'Wrong email or password', [], '', 'UNAUTHORIZED');
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Wrong email or password', [], '', 'UNAUTHORIZED');
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = hashToken(refreshToken);
  await user.save();

  res.json(
    new ApiResponse(
      200,
      { user: user.toSafeJSON(), accessToken, refreshToken },
      'Login successful'
    )
  );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', [], '', 'UNAUTHORIZED');
  }

  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== hashToken(refreshToken)) {
    throw new ApiError(401, 'Invalid or expired refresh token', [], '', 'UNAUTHORIZED');
  }

  // Rotate: issue new pair, invalidate old
  const newAccessToken = user.generateAccessToken();
  const newRefreshToken = user.generateRefreshToken();

  user.refreshToken = hashToken(newRefreshToken);
  await user.save();

  res.json(
    new ApiResponse(
      200,
      { accessToken: newAccessToken, refreshToken: newRefreshToken },
      'Tokens refreshed successfully'
    )
  );
});

export const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const user = await User.findById(req.userId);
  if (!user || !refreshToken || user.refreshToken !== hashToken(refreshToken)) {
    throw new ApiError(401, 'Invalid refresh token', [], '', 'UNAUTHORIZED');
  }
  user.refreshToken = null;
  await user.save();
  res.json(new ApiResponse(200, { ok: true }, 'Logged out successfully'));
});

// GDPR erasure: the researcher and everything they own, participant data included.
export const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new ApiError(404, 'User not found', [], '', 'NOT_FOUND');
  }
  if (!(await user.isPasswordCorrect(req.body.password))) {
    // 403, not 401: the session is fine, and a 401 would make the client refresh/log out.
    throw new ApiError(403, 'Wrong password', [], '', 'FORBIDDEN');
  }

  const experimentIds = (await Experiment.find({ owner: user._id }).select('_id')).map((e) => e._id);
  const sessionIds = (await Session.find({ experimentId: { $in: experimentIds } }).select('_id')).map((s) => s._id);
  await Trial.deleteMany({ sessionId: { $in: sessionIds } });
  await Session.deleteMany({ _id: { $in: sessionIds } });
  await Experiment.deleteMany({ _id: { $in: experimentIds } });
  await Template.deleteMany({ owner: user._id });

  const stimuli = await Stimulus.find({ owner: user._id }).select('url');
  // Blob deletion is best-effort, same as deleteStimulus.
  if (stimuli.length) await del(stimuli.map((s) => s.url)).catch(() => {});
  await Stimulus.deleteMany({ owner: user._id });

  await User.findByIdAndDelete(user._id);
  res.json(new ApiResponse(200, { deleted: true }, 'Account deleted'));
});

export const getCurrentUser =asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new ApiError(404, 'User not found', [], '', 'NOT_FOUND');
  }
  res.json(new ApiResponse(200, { user: user.toSafeJSON() }, 'User profile retrieved successfully'));
});
