import { json, withErrorHandling } from '../../lib/response';
import { listCategories } from '../../lib/categoryRepository';

export const handler = withErrorHandling(async () => {
  const categories = await listCategories();
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return json(200, { items: categories });
});
