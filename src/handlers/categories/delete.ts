import { conflict, json, notFound, withErrorHandling } from '../../lib/response';
import {
  deleteCategory,
  getCategoryById,
  getChildCategories,
  getProductIdsForCategories,
  removeCategoryMappings,
} from '../../lib/categoryRepository';
import { batchGetProducts, saveProduct } from '../../lib/productRepository';

export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const existing = await getCategoryById(id);
  if (!existing) throw notFound(`Category "${id}" not found`);

  const children = await getChildCategories(id);
  if (children.length > 0) {
    throw conflict(
      `Category has ${children.length} child categor${children.length === 1 ? 'y' : 'ies'}; delete or re-parent them first`,
    );
  }

  // Drop the category from associated products' denormalized categoryIds, then remove junction rows.
  const productIds = await getProductIdsForCategories([id]);
  const products = await batchGetProducts(productIds);
  await Promise.all(
    products.map((product) =>
      saveProduct({
        ...product,
        categoryIds: product.categoryIds.filter((cid) => cid !== id),
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
  await removeCategoryMappings(id);
  await deleteCategory(id);
  return json(200, { deleted: true, id });
});
