import { json, notFound, withErrorHandling } from '../../lib/response';
import { getPricesForSku } from '../../lib/priceRepository';
import { getProductByVariationSkuOrSlug } from '../../lib/productRepository';
import { formatPriceFields } from '../../lib/formatPrice';
import type { Price } from '../../types/price';

/**
 * Price rows for a sku. A variation sku with no rows of its own (or none in the
 * requested currency) inherits the parent product's prices — the returned rows
 * then carry the parent sku.
 */
export const handler = withErrorHandling(async (event) => {
  const sku = event.pathParameters?.sku ?? '';
  const currency = event.queryStringParameters?.currency;
  const byCurrency = (rows: Price[]) =>
    currency ? rows.filter((p) => p.currency === currency) : rows;

  let prices = byCurrency(await getPricesForSku(sku));
  if (prices.length === 0) {
    const parent = await getProductByVariationSkuOrSlug(sku);
    if (parent && parent.sku !== sku) {
      prices = byCurrency(await getPricesForSku(parent.sku));
    }
  }
  if (prices.length === 0) throw notFound(`No prices found for sku "${sku}"`);
  return json(200, { items: prices.map((p) => ({ ...p, formatted: formatPriceFields(p) })) });
});
