import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validate, limit } from '../middlewares/index.js';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
  deleteAccount,
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

const deleteSchema = z.object({
  password: z.string().min(1).max(128),
});

// ─── Routes ────────────────────────────────────────────────

router.post('/register', limit('register', 3, '1 h'), validate(registerSchema), registerUser);
router.post('/login', limit('login', 10, '15 m'), validate(loginSchema), loginUser);
router.post('/refresh', limit('refresh', 30, '15 m'), validate(refreshSchema), refreshAccessToken);
router.post('/logout', requireAuth, validate(refreshSchema), logoutUser);
router.get('/me', requireAuth, getCurrentUser);
router.delete('/me', requireAuth, limit('delete-account', 5, '1 h', { by: 'user' }), validate(deleteSchema), deleteAccount);

export default router;
