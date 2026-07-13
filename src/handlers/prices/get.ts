import { json, notFound, withErrorHandling } from '../../lib/response';
import { getPricesForSku } from '../../lib/priceRepository';
import { formatPriceFields } from '../../lib/formatPrice';

/** Raw price rows for a sku. Note: no parent fallback here — that happens on product responses. */
export const handler = withErrorHandling(async (event) => {
  const sku = event.pathParameters?.sku ?? '';
  const currency = event.queryStringParameters?.currency;
  let prices = await getPricesForSku(sku);
  if (currency) prices = prices.filter((p) => p.currency === currency);
  if (prices.length === 0) throw notFound(`No prices found for sku "${sku}"`);
  return json(200, { items: prices.map((p) => ({ ...p, formatted: formatPriceFields(p) })) });
});
