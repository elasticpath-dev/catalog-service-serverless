import { badRequest, json, notFound, withErrorHandling } from '../../lib/response';
import {
  getCategoryByIdOrSlug,
  getDescendantIds,
  getProductIdsForCategories,
  listCategories,
} from '../../lib/categoryRepository';
import { batchGetProducts } from '../../lib/productRepository';
import { attachProductPrices } from '../../lib/pricing';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/**
 * PLP endpoint: products in the category AND all of its descendants.
 * Pagination cursor is the last product id of the previous page (ids are sorted).
 */
export const handler = withErrorHandling(async (event) => {
  const idOrSlug = event.pathParameters?.idOrSlug ?? '';
  const category = await getCategoryByIdOrSlug(idOrSlug);
  if (!category) throw notFound(`Category "${idOrSlug}" not found`);

  const rawLimit = event.queryStringParameters?.limit;
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`limit must be an integer between 1 and ${MAX_LIMIT}`);
  }
  const nextToken = event.queryStringParameters?.nextToken;

  const categories = await listCategories();
  const categoryIds = getDescendantIds(category.id, categories);
  const allProductIds = await getProductIdsForCategories(categoryIds);

  const startIndex = nextToken ? allProductIds.indexOf(nextToken) + 1 : 0;
  if (nextToken && startIndex === 0) throw badRequest('Invalid nextToken');
  const pageIds = allProductIds.slice(startIndex, startIndex + limit);
  const fetched = await batchGetProducts(pageIds);
  fetched.sort((a, b) => a.name.localeCompare(b.name));
  const products = await attachProductPrices(fetched, event.queryStringParameters?.currency);

  const lastId = pageIds[pageIds.length - 1];
  const hasMore = startIndex + limit < allProductIds.length;
  return json(200, {
    category: { id: category.id, name: category.name, slug: category.slug },
    items: products,
    total: allProductIds.length,
    nextToken: hasMore ? lastId : null,
  });
});
