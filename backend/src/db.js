import mongoose from 'mongoose';

let cached = null;

export async function connectDB() {
  if (cached) return cached;
  cached = await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  await dropStaleSlugIndex();
  return cached;
}

// A unique non-partial `slug_1` index rejects the second experiment ever created
// (both drafts store `slug: null`). Mongoose can't swap it for us, so retire the
// old shape once per cluster and let the schema's partial index take over.
async function dropStaleSlugIndex() {
  try {
    const indexes = await mongoose.connection.db.collection('experiments').indexes();
    const stale = indexes.find((i) => i.name === 'slug_1' && !i.partialFilterExpression);
    if (!stale) return;
    await mongoose.connection.db.collection('experiments').dropIndex('slug_1');
    await mongoose.connection.syncIndexes();
    console.log('Dropped stale non-partial slug_1 index (partial index restored)');
  } catch (err) {
    // No write access / collection not created yet — schema autoIndex handles it.
    console.warn('Skipped slug index cleanup:', err.message);
  }
}
