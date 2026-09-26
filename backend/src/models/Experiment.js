import mongoose from 'mongoose';

const experimentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'Untitled Experiment', maxlength: 200 },
    draft: { type: mongoose.Schema.Types.Mixed, default: {} },
    versions: [
      {
        version: Number,
        snapshot: mongoose.Schema.Types.Mixed,
        publishedAt: { type: Date, default: Date.now },
      },
    ],
    slug: { type: String, default: null },
    status: { type: String, enum: ['draft', 'active', 'closed'], default: 'draft' },
  },
  { timestamps: true, minimize: false }
);

experimentSchema.index({ owner: 1 });
// ponytail: partial index — drafts (slug null/missing) skip it, real slugs stay unique
experimentSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: 'string' } } });

export default mongoose.model('Experiment', experimentSchema);
