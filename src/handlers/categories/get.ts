import { json, notFound, withErrorHandling } from '../../lib/response';
import {
  buildCategorySubtree,
  getCategoryByIdOrSlug,
  listCategories,
} from '../../lib/categoryRepository';

export const handler = withErrorHandling(async (event) => {
  const idOrSlug = event.pathParameters?.idOrSlug ?? '';
  const category = await getCategoryByIdOrSlug(idOrSlug);
  if (!category) throw notFound(`Category "${idOrSlug}" not found`);
  const subtree = buildCategorySubtree(category.id, await listCategories());
  return json(200, subtree ?? { ...category, children: [] });
});
