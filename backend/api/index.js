import 'dotenv/config';
import { connectDB } from '../src/db.js';
import { app } from '../src/app.js';

await connectDB();

const PORT = process.env.PORT || 3001;

// Local dev server — Vercel ignores this in production
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
}

export default app;
