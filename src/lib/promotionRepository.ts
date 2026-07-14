import { PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from './dynamo';
import type { Promotion } from '../types/promotion';

/** GSI lookup; eventually consistent, so the create-time uniqueness check has a small race window. */
export async function getPromotionByCode(promoCode: string): Promise<Promotion | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.promotions,
      IndexName: 'promo-code-index',
      KeyConditionExpression: 'promo_code = :code',
      ExpressionAttributeValues: { ':code': promoCode },
      Limit: 1,
    }),
  );
  return result.Items?.[0] as Promotion | undefined;
}

/** System-applied promotions = no promo_code; evaluated automatically against every cart. */
export async function listSystemPromotions(): Promise<Promotion[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLES.promotions,
      FilterExpression: 'attribute_not_exists(promo_code)',
    }),
  );
  return (result.Items ?? []) as Promotion[];
}

export async function savePromotion(promotion: Promotion): Promise<void> {
  await docClient.send(new PutCommand({ TableName: TABLES.promotions, Item: promotion }));
}
