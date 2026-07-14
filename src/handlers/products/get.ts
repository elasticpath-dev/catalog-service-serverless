import { json, notFound, withErrorHandling } from '../../lib/response';
import {
  getProductById,
  getProductBySlug,
  getProductByVariationSkuOrSlug,
} from '../../lib/productRepository';
import { attachAllPrices } from '../../lib/pricing';
import { buildVariationDetail } from '../../lib/variationDetail';

/**
 * Resolves, in order: product id, product slug, then variation sku or slug.
 * A variation match returns the variation with parent product context.
 */
export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const currency = event.queryStringParameters?.currency;

  const product = (await getProductById(id)) ?? (await getProductBySlug(id));
  if (product) return json(200, await attachAllPrices(product, currency));

  const parent = await getProductByVariationSkuOrSlug(id);
  if (!parent) throw notFound(`Product "${id}" not found`);
  const variation = parent.variations.find((v) => v.sku === id || v.slug === id)!;
  return json(200, await buildVariationDetail(parent, variation, currency));
});
