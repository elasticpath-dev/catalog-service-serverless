import { json, withErrorHandling } from '../../lib/response';
import { buildCategoryTree, listCategories } from '../../lib/categoryRepository';

export const handler = withErrorHandling(async () => {
  const categories = await listCategories();
  return json(200, { items: buildCategoryTree(categories) });
});
