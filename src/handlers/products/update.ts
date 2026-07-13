import { randomUUID } from 'crypto';
import { badRequest, conflict, json, notFound, parseBody, withErrorHandling } from '../../lib/response';
import { updateProductSchema } from '../../validation/product';
import {
  collectSkus,
  getProductById,
  getProductBySku,
  getProductBySlug,
  saveProduct,
  syncProductCategories,
} from '../../lib/productRepository';
import { getCategoryById } from '../../lib/categoryRepository';
import type { Product } from '../../types/product';

export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const existing = await getProductById(id);
  if (!existing) throw notFound(`Product "${id}" not found`);

  const parsed = updateProductSchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const patch = parsed.data;

  if (patch.sku && patch.sku !== existing.sku) {
    const other = await getProductBySku(patch.sku);
    if (other && other.id !== id) throw conflict(`A product with sku "${patch.sku}" already exists`);
  }
  if (patch.slug && patch.slug !== existing.slug) {
    const other = await getProductBySlug(patch.slug);
    if (other && other.id !== id) throw conflict(`A product with slug "${patch.slug}" already exists`);
  }

  let categoryIds = existing.categoryIds;
  if (patch.categoryIds) {
    categoryIds = [...new Set(patch.categoryIds)];
    const categories = await Promise.all(categoryIds.map(getCategoryById));
    const missing = categoryIds.filter((_, i) => !categories[i]);
    if (missing.length > 0) throw badRequest(`Unknown categoryIds: ${missing.join(', ')}`);
  }

  // Variations are replaced wholesale when provided; ids are kept if passed, generated otherwise.
  const variations = patch.variations
    ? patch.variations.map((v) => ({ ...v, id: v.id ?? randomUUID() }))
    : existing.variations;

  const updated: Product = {
    ...existing,
    ...patch,
    categoryIds,
    variations,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const newSkus = collectSkus(updated);
  if (new Set(newSkus).size !== newSkus.length) {
    throw badRequest('Product sku and variation skus must be unique within the product');
  }

  await saveProduct(updated);
  if (patch.categoryIds) {
    await syncProductCategories(id, categoryIds, existing.categoryIds);
  }
  return json(200, updated);
});
