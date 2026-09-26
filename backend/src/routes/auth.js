import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import User from '../models/User.js';
import { requireAuth, validate, rateLimit } from '../middleware.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ───────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── POST /register ────────────────────────────────────────

router.post(
  '/register',
  rateLimit,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
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

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: user.toSafeJSON(), accessToken, refreshToken },
          'User registered successfully'
        )
      );
  })
);

// ─── POST /login ───────────────────────────────────────────

router.post(
  '/login',
  rateLimit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
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
  })
);

// ─── POST /refresh ─────────────────────────────────────────

router.post(
  '/refresh',
  rateLimit,
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
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
  })
);

// ─── POST /logout ──────────────────────────────────────────

router.post('/logout', requireAuth, validate(refreshSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    // Only clear if the supplied token matches the stored hash — otherwise a
    // stolen access token alone can't log the victim out (and a wrong token = 401).
    if (!user || user.refreshToken !== hashToken(req.body.refreshToken)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
      });
    }
    user.refreshToken = null;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me ───────────────────────────────────────────────

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
      throw new ApiError(404, 'User not found', [], '', 'NOT_FOUND');
    }
    res.json(new ApiResponse(200, { user: user.toSafeJSON() }, 'User profile retrieved successfully'));
  })
);

export default router;

