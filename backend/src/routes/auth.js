import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, rateLimit } from '../middlewares/index.js';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
} from '../controllers/auth.controller.js';

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

// ─── Routes ────────────────────────────────────────────────

router.post('/register', rateLimit, validate(registerSchema), registerUser);
router.post('/login', rateLimit, validate(loginSchema), loginUser);
router.post('/refresh', rateLimit, validate(refreshSchema), refreshAccessToken);
router.post('/logout', requireAuth, validate(refreshSchema), logoutUser);
router.get('/me', requireAuth, getCurrentUser);

export default router;
