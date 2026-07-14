import { z } from 'zod';

const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code, e.g. USD');

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('amount_off'),
    value: z.number().int().positive('value must be a positive integer in minor units (cents)'),
    currency: currencySchema,
  }),
  z.object({
    type: z.literal('percentage_off'),
    value: z.number().gt(0, 'percentage must be > 0').max(100, 'percentage must be <= 100'),
  }),
]);

const criteriaSchema = z.object({
  cartTotalGreaterThan: z
    .number()
    .int()
    .positive('cartTotalGreaterThan must be a positive integer in minor units (cents)'),
  currency: currencySchema,
});

export const createPromotionSchema = z
  .object({
    // Absent = system-applied promotion (evaluated against every cart without a code).
    promo_code: z.string().min(1).optional(),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
    // Empty array = applies to all SKUs (catalog-wide).
    skus: z.array(z.string().min(1)).default([]),
    // Present = cart-level promotion.
    criteria: criteriaSchema.optional(),
    action: actionSchema,
  })
  .refine((p) => new Date(p.endDate).getTime() > new Date(p.startDate).getTime(), {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  })
  .refine((p) => !(p.criteria && p.skus.length > 0), {
    message: 'criteria and skus are mutually exclusive: a cart-level promotion cannot target skus',
    path: ['criteria'],
  });

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

export const applyPromotionSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  currency: currencySchema,
  code: z.string().min(1).optional(),
});

export type ApplyPromotionInput = z.infer<typeof applyPromotionSchema>;
