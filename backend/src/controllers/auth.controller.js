import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
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
  await User.findByIdAndUpdate(req.userId, { refreshToken: null });
  res.json(new ApiResponse(200, { ok: true }, 'Logged out successfully'));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw new ApiError(404, 'User not found', [], '', 'NOT_FOUND');
  }
  res.json(new ApiResponse(200, { user: user.toSafeJSON() }, 'User profile retrieved successfully'));
});
