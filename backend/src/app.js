import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import runRoutes from './routes/run.js';
import experimentRoutes from './routes/experiments.js';
import stimuliRoutes from './routes/stimuli.js';
import resultRoutes from './routes/results.js';
import generateRoutes from './routes/generate.js';
import templateRoutes from './routes/templates.js';

import { ApiResponse } from './utils/index.js';

export const app = express();

// ─── Global middleware ─────────────────────────────────────
// Production is locked to CORS_ORIGIN (comma-separated) or FRONTEND_URL; '*' is a dev convenience only.
const allowed = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '');
const corsOrigin = allowed ? allowed.split(',').map((o) => o.trim()) : '*';
// Content-Disposition exposed so the Results export can read the download filename.
app.use(cors({ origin: corsOrigin, exposedHeaders: ['Content-Disposition'] }));
// ponytail: the few headers a JSON API needs; add helmet if this ever serves HTML.
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  });
  next();
});
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/plain' })); // for beacon route

// ─── Health ────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json(new ApiResponse(200, { status: 'ok', timestamp: new Date().toISOString() }, 'Server is healthy'));
});

// ─── Routes ────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/run', runRoutes);
app.use('/api/v1/experiments', experimentRoutes);
app.use('/api/v1/stimuli', stimuliRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/generate', generateRoutes);
app.use('/api/v1/templates', templateRoutes);

// ─── Global error handler ─────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Something went wrong';
  const code =
    err.code ||
    (statusCode === 400
      ? 'VALIDATION_ERROR'
      : statusCode === 401
      ? 'UNAUTHORIZED'
      : statusCode === 403
      ? 'FORBIDDEN'
      : statusCode === 404
      ? 'NOT_FOUND'
      : statusCode === 409
      ? 'CONFLICT'
      : statusCode === 410
      ? 'GONE'
      : statusCode === 429
      ? 'RATE_LIMITED'
      : 'INTERNAL_ERROR');

  res.status(statusCode).json({
    statusCode,
    success: false,
    message,
    errors: err.errors || [],
    error: {
      code,
      message,
    },
  });
});

