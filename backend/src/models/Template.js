import mongoose from 'mongoose';

// A researcher's own reusable experiment design (draft snapshot).
const templateSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 500 },
    draft: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false }
);

templateSchema.index({ owner: 1, updatedAt: -1 });

export default mongoose.model('Template', templateSchema);
