import { json, notFound, withErrorHandling } from '../../lib/response';
import { deletePrice, getPrice } from '../../lib/priceRepository';

export const handler = withErrorHandling(async (event) => {
  const sku = event.pathParameters?.sku ?? '';
  const currency = event.pathParameters?.currency ?? '';
  if (!(await getPrice(sku, currency))) {
    throw notFound(`No ${currency} price found for sku "${sku}"`);
  }
  await deletePrice(sku, currency);
  return json(200, { deleted: true, sku, currency });
});
