import { randomUUID } from 'crypto';
import { badRequest, conflict, json, parseBody, withErrorHandling } from '../../lib/response';
import { createPromotionSchema } from '../../validation/promotion';
import { getPromotionByCode, savePromotion } from '../../lib/promotionRepository';
import type { Promotion } from '../../types/promotion';

export const handler = withErrorHandling(async (event) => {
  const parsed = createPromotionSchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const input = parsed.data;

  if (input.promo_code && (await getPromotionByCode(input.promo_code))) {
    throw conflict(`A promotion with promo_code "${input.promo_code}" already exists`);
  }

  const now = new Date().toISOString();
  const promotion: Promotion = {
    ...input,
    skus: [...new Set(input.skus)],
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  await savePromotion(promotion);
  return json(201, promotion);
});
