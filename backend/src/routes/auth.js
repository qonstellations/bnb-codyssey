import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import User from '../models/User.js';
import { requireAuth, validate } from '../middleware.js';

const router = Router();

// ─── Schemas ───────────────────────────────────────────────

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ─── Helpers ───────────────────────────────────────────────

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ─── POST /register ────────────────────────────────────────

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'Email already registered' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    res.status(201).json({ user: user.toSafeJSON(), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// ─── POST /login ───────────────────────────────────────────

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Wrong email or password' },
      });
    }

    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = hashToken(refreshToken);
    await user.save();

    res.json({ user: user.toSafeJSON(), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// ─── POST /refresh ─────────────────────────────────────────

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
      });
    }

    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== hashToken(refreshToken)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
      });
    }

    // Rotate: issue new pair, invalidate old
    const newAccessToken = generateAccessToken(user._id.toString());
    const newRefreshToken = generateRefreshToken(user._id.toString());

    user.refreshToken = hashToken(newRefreshToken);
    await user.save();

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// ─── POST /logout ──────────────────────────────────────────

router.post('/logout', requireAuth, validate(refreshSchema), async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { refreshToken: null });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /me ───────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    next(err);
  }
});

export default router;
