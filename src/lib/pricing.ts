import { formatPriceFields } from './formatPrice';
import { getPricesForSkus } from './priceRepository';
import { collectSkus } from './productRepository';
import type { Price, PriceView } from '../types/price';
import type { Product, ProductVariation } from '../types/product';

export type VariationWithPrices = ProductVariation & { prices: PriceView[] };
export type ProductWithPrices = Omit<Product, 'variations'> & {
  prices: PriceView[];
  variations: (ProductVariation | VariationWithPrices)[];
};

function toViews(prices: Price[], currency?: string): PriceView[] {
  return prices
    .filter((p) => !currency || p.currency === currency)
    .map(({ currency: c, listPrice, salePrice }) => ({
      currency: c,
      listPrice,
      ...(salePrice !== undefined ? { salePrice } : {}),
      formatted: formatPriceFields({ currency: c, listPrice, salePrice }),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * Per-currency merge implementing the variation -> parent fallback:
 * a variation's own price wins for its currency; currencies it lacks
 * inherit the parent product's price.
 */
function mergeWithFallback(variationPrices: Price[], productPrices: Price[]): Price[] {
  const covered = new Set(variationPrices.map((p) => p.currency));
  return [...variationPrices, ...productPrices.filter((p) => !covered.has(p.currency))];
}

/** Attaches product-level prices only — used by list/PLP responses. */
export async function attachProductPrices(
  products: Product[],
  currency?: string,
): Promise<ProductWithPrices[]> {
  const bySku = await getPricesForSkus(products.map((p) => p.sku));
  return products.map((product) => ({
    ...product,
    prices: toViews(bySku.get(product.sku) ?? [], currency),
  }));
}

/** Full PDP enrichment: product prices plus per-variation prices with parent fallback. */
export async function attachAllPrices(
  product: Product,
  currency?: string,
): Promise<ProductWithPrices> {
  const bySku = await getPricesForSkus(collectSkus(product));
  const productPrices = bySku.get(product.sku) ?? [];
  return {
    ...product,
    prices: toViews(productPrices, currency),
    variations: product.variations.map((v) => ({
      ...v,
      prices: toViews(mergeWithFallback(bySku.get(v.sku) ?? [], productPrices), currency),
    })),
  };
}
