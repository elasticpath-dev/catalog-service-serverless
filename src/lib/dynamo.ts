import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// serverless-offline sets IS_OFFLINE=true; the seed script sets DYNAMODB_ENDPOINT explicitly.
const localEndpoint =
  process.env.DYNAMODB_ENDPOINT ?? (process.env.IS_OFFLINE ? 'http://localhost:8000' : undefined);

const client = new DynamoDBClient(
  localEndpoint
    ? {
        endpoint: localEndpoint,
        region: 'localhost',
        credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
      }
    : {},
);

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  products: process.env.PRODUCTS_TABLE ?? '',
  categories: process.env.CATEGORIES_TABLE ?? '',
  productCategories: process.env.PRODUCT_CATEGORIES_TABLE ?? '',
  prices: process.env.PRICES_TABLE ?? '',
  promotions: process.env.PROMOTIONS_TABLE ?? '',
};
