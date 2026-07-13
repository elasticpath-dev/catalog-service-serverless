import { badRequest, json, notFound, withErrorHandling } from '../../lib/response';
import { getProductById, getProductBySku, getProductBySlug } from '../../lib/productRepository';
import { attachAllPrices } from '../../lib/pricing';

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

  if (!product) throw notFound('No product matches the given criteria');
  return json(200, await attachAllPrices(product, currency));
});
