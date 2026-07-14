import { badRequest, json, notFound, withErrorHandling } from '../../lib/response';
import {
  getProductById,
  getProductBySku,
  getProductBySlug,
  getProductByVariationSkuOrSlug,
} from '../../lib/productRepository';
import { attachAllPrices } from '../../lib/pricing';
import { buildVariationDetail } from '../../lib/variationDetail';

/**
 * Exact-match lookup by one of: id, sku, slug. A sku or slug that belongs to a
 * variation resolves to that variation with parent product context.
 */
export const handler = withErrorHandling(async (event) => {
  const { id, sku, slug, currency } = event.queryStringParameters ?? {};
  const provided = [id, sku, slug].filter(Boolean);
  if (provided.length !== 1) {
    throw badRequest('Provide exactly one of: id, sku, slug');
  }

  const product = id
    ? await getProductById(id)
    : sku
      ? await getProductBySku(sku)
      : await getProductBySlug(slug!);
  if (product) return json(200, await attachAllPrices(product, currency));

  if (sku || slug) {
    const parent = await getProductByVariationSkuOrSlug((sku ?? slug)!);
    const variation = parent?.variations.find((v) => (sku ? v.sku === sku : v.slug === slug));
    if (parent && variation) {
      return json(200, await buildVariationDetail(parent, variation, currency));
    }
  }

  throw notFound('No product matches the given criteria');
});
