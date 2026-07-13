import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from './dynamo';
import type { Category, CategoryTreeNode } from '../types/category';

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: TABLES.categories, Key: { id } }));
  return result.Item as Category | undefined;
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.categories,
      IndexName: 'slug-index',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
      Limit: 1,
    }),
  );
  return result.Items?.[0] as Category | undefined;
}

export async function getCategoryByIdOrSlug(idOrSlug: string): Promise<Category | undefined> {
  return (await getCategoryById(idOrSlug)) ?? (await getCategoryBySlug(idOrSlug));
}

/** Taxonomies are small; a full Scan (paginated) is the simplest correct read. */
export async function listCategories(): Promise<Category[]> {
  const categories: Category[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: TABLES.categories, ExclusiveStartKey: startKey }),
    );
    categories.push(...((result.Items ?? []) as Category[]));
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return categories;
}

export async function saveCategory(category: Category): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLES.categories, Item: category }));
}

export async function deleteCategory(id: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLES.categories, Key: { id } }));
}

export async function getChildCategories(parentId: string): Promise<Category[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.categories,
      IndexName: 'parent-index',
      KeyConditionExpression: 'parentId = :pid',
      ExpressionAttributeValues: { ':pid': parentId },
    }),
  );
  return (result.Items ?? []) as Category[];
}

/** Links every category to its parent node; returns the node map plus the roots. */
function linkCategoryNodes(categories: Category[]): {
  nodes: Map<string, CategoryTreeNode>;
  roots: CategoryTreeNode[];
} {
  const nodes = new Map<string, CategoryTreeNode>(
    categories.map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortByName = (list: CategoryTreeNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((n) => sortByName(n.children));
  };
  sortByName(roots);
  return { nodes, roots };
}

export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  return linkCategoryNodes(categories).roots;
}

/** The category with its full descendant subtree nested under `children`. */
export function buildCategorySubtree(
  categoryId: string,
  categories: Category[],
): CategoryTreeNode | undefined {
  return linkCategoryNodes(categories).nodes.get(categoryId);
}

/** The category itself plus every descendant, walked in memory from the full category list. */
export function getDescendantIds(categoryId: string, categories: Category[]): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const siblings = childrenByParent.get(c.parentId) ?? [];
    siblings.push(c.id);
    childrenByParent.set(c.parentId, siblings);
  }
  const ids: string[] = [];
  const queue = [categoryId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    ids.push(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return ids;
}

/** True if `candidateAncestorId` is `categoryId` itself or one of its ancestors — used to reject re-parenting cycles. */
export function isSelfOrAncestor(
  categoryId: string,
  candidateAncestorId: string,
  categories: Category[],
): boolean {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let current: Category | undefined = byId.get(candidateAncestorId);
  while (current) {
    if (current.id === categoryId) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

/** Deduped product ids directly assigned to any of the given categories, sorted for stable pagination. */
export async function getProductIdsForCategories(categoryIds: string[]): Promise<string[]> {
  const results = await Promise.all(
    categoryIds.map(async (categoryId) => {
      const ids: string[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.productCategories,
            KeyConditionExpression: 'categoryId = :cid',
            ExpressionAttributeValues: { ':cid': categoryId },
            ExclusiveStartKey: startKey,
          }),
        );
        ids.push(...(result.Items ?? []).map((item) => item.productId as string));
        startKey = result.LastEvaluatedKey;
      } while (startKey);
      return ids;
    }),
  );
  return [...new Set(results.flat())].sort();
}

/** Removes every product mapping for a category (used when the category is deleted). */
export async function removeCategoryMappings(categoryId: string): Promise<void> {
  const productIds = await getProductIdsForCategories([categoryId]);
  for (let i = 0; i < productIds.length; i += 25) {
    let writes = productIds
      .slice(i, i + 25)
      .map((productId) => ({ DeleteRequest: { Key: { categoryId, productId } } }));
    while (writes.length > 0) {
      const result = await docClient.send(
        new BatchWriteCommand({ RequestItems: { [TABLES.productCategories]: writes } }),
      );
      writes = (result.UnprocessedItems?.[TABLES.productCategories] ?? []) as typeof writes;
    }
  }
}
