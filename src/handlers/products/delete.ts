import { json, notFound, withErrorHandling } from '../../lib/response';
import {
  collectSkus,
  deleteProduct,
  getProductById,
  removeAllProductCategories,
} from '../../lib/productRepository';
import { deletePricesForSkus } from '../../lib/priceRepository';

export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const existing = await getProductById(id);
  if (!existing) throw notFound(`Product "${id}" not found`);

  await removeAllProductCategories(id);
  await deletePricesForSkus(collectSkus(existing));
  await deleteProduct(id);
  return json(200, { deleted: true, id });
});
