import { json, notFound, withErrorHandling } from '../../lib/response';
import { getProductById } from '../../lib/productRepository';
import { attachAllPrices } from '../../lib/pricing';

export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const product = await getProductById(id);
  if (!product) throw notFound(`Product "${id}" not found`);
  return json(200, await attachAllPrices(product, event.queryStringParameters?.currency));
});
