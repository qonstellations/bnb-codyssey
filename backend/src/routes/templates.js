import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import Template from '../models/Template.js';
import { requireAuth, validate } from '../middlewares/index.js';
import { experimentSchema } from '../validators/experimentSchema.js';
import { asyncHandler, ApiError, ApiResponse } from '../utils/index.js';

const router = Router();
const MAX_PER_USER = 50;

const createSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  description: z.string().max(500).optional(),
  draft: experimentSchema,
});

// Owner-scoped lookup: someone else's (or a malformed) id is a plain 404.
async function findOwned(req) {
  const { id } = req.params;
  const template = isValidObjectId(id) ? await Template.findOne({ _id: id, owner: req.userId }) : null;
  if (!template) throw new ApiError(404, 'Template not found', [], '', 'NOT_FOUND');
  return template;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const templates = await Template.find({ owner: req.userId })
      .select('title description updatedAt createdAt')
      .sort({ updatedAt: -1 });
    res.json(new ApiResponse(200, { templates }, 'Templates retrieved successfully'));
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(new ApiResponse(200, { template: await findOwned(req) }, 'Template retrieved successfully'));
  })
);

router.post(
  '/',
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    if ((await Template.countDocuments({ owner: req.userId })) >= MAX_PER_USER) {
      throw new ApiError(409, `Template limit reached (${MAX_PER_USER}) — delete one first`, [], '', 'CONFLICT');
    }
    const { title, description = '', draft } = req.body;
    const template = await Template.create({ owner: req.userId, title, description, draft });
    res.status(201).json(new ApiResponse(201, { template }, 'Template saved'));
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const template = await findOwned(req);
    await template.deleteOne();
    res.json(new ApiResponse(200, { deleted: true }, 'Template deleted'));
  })
);

export default router;
