import { badRequest, json, parseBody, withErrorHandling } from '../../lib/response';
import { upsertPriceSchema } from '../../validation/price';
import { getPrice, savePrice } from '../../lib/priceRepository';
import { formatPriceFields } from '../../lib/formatPrice';
import type { Price } from '../../types/price';

export const handler = withErrorHandling(async (event) => {
  const parsed = upsertPriceSchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const input = parsed.data;

  const existing = await getPrice(input.sku, input.currency);
  const now = new Date().toISOString();
  const price: Price = {
    sku: input.sku,
    currency: input.currency,
    listPrice: input.listPrice,
    ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await savePrice(price);
  return json(existing ? 200 : 201, { ...price, formatted: formatPriceFields(price) });
});
