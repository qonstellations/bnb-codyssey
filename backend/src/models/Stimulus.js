import mongoose from 'mongoose';

const stimulusSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, maxlength: 200 },
    type: { type: String, enum: ['image', 'audio', 'video'], required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stimulusSchema.index({ owner: 1 });

export default mongoose.model('Stimulus', stimulusSchema);
