import categoriesData from '../../data/categories.json';
import productsData from '../../data/products.json';
import pricesData from '../../data/prices.json';
import { getCategoryById, saveCategory } from './categoryRepository';
import { getProductById, saveProduct, syncProductCategories } from './productRepository';
import { getPrice, savePrice } from './priceRepository';
import type { Category } from '../types/category';
import type { Product } from '../types/product';
import type { Price } from '../types/price';

export interface SeedResult {
  categories: { created: number; updated: number };
  products: { created: number; updated: number };
  prices: { created: number; updated: number };
}

/**
 * Idempotent upsert of the bundled seed data, keyed on the fixed ids in data/*.json:
 * existing items keep their createdAt; junction rows are synced to each product's categoryIds.
 */
export async function seedCatalog(): Promise<SeedResult> {
  const result: SeedResult = {
    categories: { created: 0, updated: 0 },
    products: { created: 0, updated: 0 },
    prices: { created: 0, updated: 0 },
  };
  const now = new Date().toISOString();

  for (const raw of categoriesData as unknown as Category[]) {
    const existing = await getCategoryById(raw.id);
    await saveCategory({
      ...raw,
      createdAt: existing?.createdAt ?? raw.createdAt ?? now,
      updatedAt: now,
    });
    existing ? result.categories.updated++ : result.categories.created++;
  }

  for (const raw of productsData as unknown as Product[]) {
    const existing = await getProductById(raw.id);
    await saveProduct({
      ...raw,
      createdAt: existing?.createdAt ?? raw.createdAt ?? now,
      updatedAt: now,
    });
    await syncProductCategories(raw.id, raw.categoryIds, existing?.categoryIds ?? []);
    existing ? result.products.updated++ : result.products.created++;
  }

  for (const raw of pricesData as Price[]) {
    const existing = await getPrice(raw.sku, raw.currency);
    await savePrice({
      ...raw,
      createdAt: existing?.createdAt ?? raw.createdAt ?? now,
      updatedAt: now,
    });
    existing ? result.prices.updated++ : result.prices.created++;
  }

  return result;
}
