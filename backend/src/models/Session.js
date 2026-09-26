import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment', required: true },
  participantId: { type: String, required: true },
  deviceInfo: {
    browser: { type: String },
    os: { type: String },
    screenW: { type: Number },
    screenH: { type: Number },
    pixelRatio: { type: Number },
  },
  calibration: {
    refreshRate: { type: Number },
    jitter: { type: Number },
    score: { type: Number },
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'abandoned'],
    default: 'in_progress',
  },
  excluded: { type: Boolean, default: false },
  withdrawCode: { type: String, required: true, unique: true, select: false }, // participant-only; never in researcher payloads
  tokenHash: { type: String, select: false }, // sha256 of the participant's write token
  version: { type: Number }, // published version this participant ran
  seed: { type: Number }, // trial-order PRNG seed, reproduces the shuffle
  consent: {
    agreedAt: { type: Date }, // server-stamped; a session is only created after the participant agrees
    textHash: { type: String }, // sha256 of the consent text they saw
  },
  engagement: {
    tabSwitches: { type: Number },
    blurCount: { type: Number },
    fullscreenExits: { type: Number },
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
});

sessionSchema.index({ experimentId: 1 });

export default mongoose.model('Session', sessionSchema);
