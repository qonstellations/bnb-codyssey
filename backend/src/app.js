import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import runRoutes from './routes/run.js';
import experimentRoutes from './routes/experiments.js';
import stimuliRoutes from './routes/stimuli.js';
import resultRoutes from './routes/results.js';

export const app = express();

// ─── Global middleware ─────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: 'text/plain' })); // for beacon route

// ─── Health ────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/run', runRoutes);
app.use('/api/v1/experiments', experimentRoutes);
app.use('/api/v1/stimuli', stimuliRoutes);
app.use('/api/v1/results', resultRoutes);

// ─── Global error handler ─────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Something went wrong',
    },
  });
});
