import { z } from 'zod';

export const upsertPriceSchema = z
  .object({
    sku: z.string().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code, e.g. USD'),
    listPrice: z.number().int().positive('listPrice must be a positive integer in minor units (cents)'),
    salePrice: z.number().int().positive().optional(),
  })
  .refine((p) => p.salePrice === undefined || p.salePrice < p.listPrice, {
    message: 'salePrice must be lower than listPrice',
  });

export type UpsertPriceInput = z.infer<typeof upsertPriceSchema>;
