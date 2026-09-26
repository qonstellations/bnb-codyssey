import mongoose from 'mongoose';

const trialSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    trialIndex: { type: Number, required: true },
    blockId: { type: String, required: true },
    condition: { type: String, required: true },
    stimulus: {
      type: { type: String, enum: ['text', 'image', 'audio'] },
      content: { type: String, default: null },
      url: { type: String, default: null },
    },
    response: { type: String, default: null },
    correct: { type: Boolean, default: null },
    rt: { type: Number, default: null },
    frameData: {
      intended: { type: Number },
      actual: { type: Number },
      dropped: { type: Number },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// trialIndex is session-global, so this also makes retried uploads idempotent.
trialSchema.index({ sessionId: 1, trialIndex: 1 }, { unique: true });

export default mongoose.model('Trial', trialSchema);
