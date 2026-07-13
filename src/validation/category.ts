import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens');

export const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: slugSchema,
  description: z.string().optional(),
  parentId: z.string().min(1).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1),
    slug: slugSchema,
    description: z.string(),
    parentId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
