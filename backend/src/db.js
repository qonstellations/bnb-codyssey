import mongoose from 'mongoose';

let cached = null;

export async function connectDB() {
  if (cached) return cached;
  cached = await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
  return cached;
}
