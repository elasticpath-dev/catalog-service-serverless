import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from './dynamo';
import type { Price } from '../types/price';

export async function getPrice(sku: string, currency: string): Promise<Price | undefined> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.prices, Key: { sku, currency } }),
  );
  return result.Item as Price | undefined;
}

/** All currency rows for one sku. */
export async function getPricesForSku(sku: string): Promise<Price[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.prices,
      KeyConditionExpression: 'sku = :sku',
      ExpressionAttributeValues: { ':sku': sku },
    }),
  );
  return (result.Items ?? []) as Price[];
}

/** Prices for many skus at once, keyed by sku. */
export async function getPricesForSkus(skus: string[]): Promise<Map<string, Price[]>> {
  const unique = [...new Set(skus)];
  const results = await Promise.all(unique.map(getPricesForSku));
  return new Map(unique.map((sku, i) => [sku, results[i]]));
}

export async function savePrice(price: Price): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLES.prices, Item: price }));
}

export async function deletePrice(sku: string, currency: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: TABLES.prices, Key: { sku, currency } }));
}

/** Removes every currency row for the given skus (used when a product is deleted). */
export async function deletePricesForSkus(skus: string[]): Promise<void> {
  const bySku = await getPricesForSkus(skus);
  const rows = [...bySku.values()].flat();
  await Promise.all(rows.map((p) => deletePrice(p.sku, p.currency)));
}
