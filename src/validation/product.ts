import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens');

const variationSchema = z.object({
  id: z.string().min(1).optional(),
  sku: z.string().min(1),
  options: z
    .record(z.string())
    .refine((o) => Object.keys(o).length > 0, 'variation must have at least one option (e.g. size, color)'),
  images: z.array(z.string().url()).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  sku: z.string().min(1),
  slug: slugSchema,
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.string()).default({}),
  categoryIds: z.array(z.string().min(1)).min(1, 'product must belong to at least one category'),
  variations: z.array(variationSchema).default([]),
});

export const updateProductSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    sku: z.string().min(1),
    slug: slugSchema,
    images: z.array(z.string().url()),
    attributes: z.record(z.string()),
    categoryIds: z.array(z.string().min(1)).min(1),
    variations: z.array(variationSchema),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'at least one field is required' });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
