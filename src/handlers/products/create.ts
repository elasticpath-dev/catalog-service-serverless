import { randomUUID } from 'crypto';
import { badRequest, conflict, json, parseBody, withErrorHandling } from '../../lib/response';
import { createProductSchema } from '../../validation/product';
import {
  collectSkus,
  getProductBySku,
  getProductBySlug,
  saveProduct,
  syncProductCategories,
} from '../../lib/productRepository';
import { getCategoryById } from '../../lib/categoryRepository';
import type { Product } from '../../types/product';

export const handler = withErrorHandling(async (event) => {
  const parsed = createProductSchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const input = parsed.data;

  const skus = collectSkus(input);
  if (new Set(skus).size !== skus.length) {
    throw badRequest('Product sku and variation skus must be unique within the product');
  }
  if (await getProductBySku(input.sku)) throw conflict(`A product with sku "${input.sku}" already exists`);
  if (await getProductBySlug(input.slug)) throw conflict(`A product with slug "${input.slug}" already exists`);

  const categoryIds = [...new Set(input.categoryIds)];
  const categories = await Promise.all(categoryIds.map(getCategoryById));
  const missing = categoryIds.filter((_, i) => !categories[i]);
  if (missing.length > 0) throw badRequest(`Unknown categoryIds: ${missing.join(', ')}`);

  const now = new Date().toISOString();
  const product: Product = {
    ...input,
    id: randomUUID(),
    categoryIds,
    variations: input.variations.map((v) => ({ ...v, id: v.id ?? randomUUID() })),
    createdAt: now,
    updatedAt: now,
  };
  await saveProduct(product);
  await syncProductCategories(product.id, categoryIds);
  return json(201, product);
});
