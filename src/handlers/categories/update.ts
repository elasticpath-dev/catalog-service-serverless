import { badRequest, conflict, json, notFound, parseBody, withErrorHandling } from '../../lib/response';
import { updateCategorySchema } from '../../validation/category';
import {
  getCategoryById,
  getCategoryBySlug,
  isSelfOrAncestor,
  listCategories,
  saveCategory,
} from '../../lib/categoryRepository';
import type { Category } from '../../types/category';

export const handler = withErrorHandling(async (event) => {
  const id = event.pathParameters?.id ?? '';
  const existing = await getCategoryById(id);
  if (!existing) throw notFound(`Category "${id}" not found`);

  const parsed = updateCategorySchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const patch = parsed.data;

  if (patch.slug && patch.slug !== existing.slug) {
    const other = await getCategoryBySlug(patch.slug);
    if (other && other.id !== id) throw conflict(`A category with slug "${patch.slug}" already exists`);
  }

  if (patch.parentId != null) {
    if (!(await getCategoryById(patch.parentId))) {
      throw badRequest(`Parent category "${patch.parentId}" does not exist`);
    }
    const categories = await listCategories();
    if (isSelfOrAncestor(id, patch.parentId, categories)) {
      throw conflict('A category cannot be parented to itself or one of its descendants');
    }
  }

  const { parentId: patchParentId, ...rest } = patch;
  const updated: Category = {
    ...existing,
    ...rest,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  // parentId: null re-parents to top level (the attribute is dropped -> stays out of the sparse GSI)
  if (patchParentId === null) delete updated.parentId;
  else if (patchParentId !== undefined) updated.parentId = patchParentId;

  await saveCategory(updated);
  return json(200, updated);
});
