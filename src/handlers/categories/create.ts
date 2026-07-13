import { randomUUID } from 'crypto';
import { badRequest, conflict, json, parseBody, withErrorHandling } from '../../lib/response';
import { createCategorySchema } from '../../validation/category';
import { getCategoryById, getCategoryBySlug, saveCategory } from '../../lib/categoryRepository';
import type { Category } from '../../types/category';

export const handler = withErrorHandling(async (event) => {
  const parsed = createCategorySchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const input = parsed.data;

  if (await getCategoryBySlug(input.slug)) {
    throw conflict(`A category with slug "${input.slug}" already exists`);
  }
  if (input.parentId && !(await getCategoryById(input.parentId))) {
    throw badRequest(`Parent category "${input.parentId}" does not exist`);
  }

  const now = new Date().toISOString();
  const category: Category = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
  await saveCategory(category);
  return json(201, category);
});
