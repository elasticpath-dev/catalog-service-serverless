import { badRequest, json, withErrorHandling } from '../../lib/response';
import { listProducts } from '../../lib/productRepository';
import { attachProductPrices } from '../../lib/pricing';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const handler = withErrorHandling(async (event) => {
  const rawLimit = event.queryStringParameters?.limit;
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  const page = await listProducts(limit, event.queryStringParameters?.nextToken);
  const items = await attachProductPrices(page.items, event.queryStringParameters?.currency);
  return json(200, { items, nextToken: page.nextToken ?? null });
});
