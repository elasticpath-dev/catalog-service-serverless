import { seedCatalog } from '../lib/seed';

/** Invoked automatically after deploy (npm run deploy) or manually via `serverless invoke -f seed`. */
export const handler = async () => {
  const result = await seedCatalog();
  console.log('Seed complete', JSON.stringify(result));
  return result;
};
