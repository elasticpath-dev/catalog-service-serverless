import {
  BatchGetCommand,
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from './dynamo';
import type { Product } from '../types/product';

export async function getProductById(id: string): Promise<Product | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: TABLES.products, Key: { id } }));
  return result.Item as Product | undefined;
}

/** Every sku a product owns: its own plus each variation's. Used to reject in-product duplicates. */
export function collectSkus(product: { sku: string; variations?: { sku: string }[] }): string[] {
  return [product.sku, ...(product.variations ?? []).map((v) => v.sku)];
}

/** Looks up by the parent product sku (variation skus are not indexed). */
export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.products,
      IndexName: 'sku-index',
      KeyConditionExpression: 'sku = :sku',
      ExpressionAttributeValues: { ':sku': sku },
      Limit: 1,
    }),
  );
  return result.Items?.[0] as Product | undefined;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.products,
      IndexName: 'slug-index',
      KeyConditionExpression: 'slug = :slug',
      ExpressionAttributeValues: { ':slug': slug },
      Limit: 1,
    }),
  );
  return result.Items?.[0] as Product | undefined;
}

export interface ProductPage {
  items: Product[];
  nextToken?: string;
}

export async function listProducts(limit: number, nextToken?: string): Promise<ProductPage> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLES.products,
      Limit: limit,
      ExclusiveStartKey: nextToken ? decodeToken(nextToken) : undefined,
    }),
  );
  return {
    items: (result.Items ?? []) as Product[],
    nextToken: result.LastEvaluatedKey ? encodeToken(result.LastEvaluatedKey) : undefined,
  };
}

export async function saveProduct(product: Product): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLES.products, Item: product }));
}

export async function deleteProduct(id: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLES.products, Key: { id } }));
}

export async function batchGetProducts(ids: string[]): Promise<Product[]> {
  const products: Product[] = [];
  // BatchGet allows at most 100 keys per request; retry unprocessed keys.
  for (let i = 0; i < ids.length; i += 100) {
    let keys: Record<string, unknown>[] = ids.slice(i, i + 100).map((id) => ({ id }));
    while (keys.length > 0) {
      const result = await docClient.send(
        new BatchGetCommand({ RequestItems: { [TABLES.products]: { Keys: keys } } }),
      );
      products.push(...((result.Responses?.[TABLES.products] ?? []) as Product[]));
      keys = result.UnprocessedKeys?.[TABLES.products]?.Keys ?? [];
    }
  }
  return products;
}

/** Junction-table sync: make the stored mappings match the product's categoryIds. */
export async function syncProductCategories(
  productId: string,
  newCategoryIds: string[],
  oldCategoryIds: string[] = [],
): Promise<void> {
  const toAdd = newCategoryIds.filter((id) => !oldCategoryIds.includes(id));
  const toRemove = oldCategoryIds.filter((id) => !newCategoryIds.includes(id));
  const writes = [
    ...toAdd.map((categoryId) => ({ PutRequest: { Item: { categoryId, productId } } })),
    ...toRemove.map((categoryId) => ({ DeleteRequest: { Key: { categoryId, productId } } })),
  ];
  await batchWriteJunction(writes);
}

export async function removeAllProductCategories(productId: string): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.productCategories,
      IndexName: 'product-index',
      KeyConditionExpression: 'productId = :pid',
      ExpressionAttributeValues: { ':pid': productId },
    }),
  );
  const writes = (result.Items ?? []).map((item) => ({
    DeleteRequest: { Key: { categoryId: item.categoryId, productId: item.productId } },
  }));
  await batchWriteJunction(writes);
}

type JunctionWrite =
  | { PutRequest: { Item: Record<string, unknown> } }
  | { DeleteRequest: { Key: Record<string, unknown> } };

async function batchWriteJunction(writes: JunctionWrite[]): Promise<void> {
  // BatchWrite allows at most 25 requests per call; retry unprocessed items.
  for (let i = 0; i < writes.length; i += 25) {
    let batch = writes.slice(i, i + 25);
    while (batch.length > 0) {
      const result = await docClient.send(
        new BatchWriteCommand({ RequestItems: { [TABLES.productCategories]: batch } }),
      );
      batch = (result.UnprocessedItems?.[TABLES.productCategories] ?? []) as JunctionWrite[];
    }
  }
}

function encodeToken(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeToken(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid nextToken');
  }
}
