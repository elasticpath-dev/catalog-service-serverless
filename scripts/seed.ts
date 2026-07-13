/**
 * Manual seed script.
 *
 *   npm run seed                     # local DynamoDB (http://localhost:8000, stage "local")
 *   npm run seed:aws -- --stage dev  # deployed AWS tables (uses your AWS credentials)
 */
const args = process.argv.slice(2);
const useAws = args.includes('--aws');
const stageFlag = args.indexOf('--stage');
const stage = stageFlag !== -1 ? args[stageFlag + 1] : useAws ? 'dev' : 'local';

if (!stage) {
  console.error('Missing value for --stage');
  process.exit(1);
}

process.env.PRODUCTS_TABLE = `catalog-products-${stage}`;
process.env.CATEGORIES_TABLE = `catalog-categories-${stage}`;
process.env.PRODUCT_CATEGORIES_TABLE = `catalog-product-categories-${stage}`;
process.env.PRICES_TABLE = `catalog-prices-${stage}`;
if (!useAws) {
  process.env.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
}

async function main() {
  // Imported after env vars are set - the dynamo client reads them at module load.
  const { seedCatalog } = await import('../src/lib/seed');
  const target = useAws ? `AWS (stage: ${stage})` : `local DynamoDB at ${process.env.DYNAMODB_ENDPOINT}`;
  console.log(`Seeding ${target}...`);
  const result = await seedCatalog();
  console.log(
    `Categories: ${result.categories.created} created, ${result.categories.updated} updated\n` +
      `Products:   ${result.products.created} created, ${result.products.updated} updated\n` +
      `Prices:     ${result.prices.created} created, ${result.prices.updated} updated`,
  );
}

main().catch((err) => {
  console.error('Seed failed:', err.message ?? err);
  process.exit(1);
});
