import { getVariationPriceViews } from './pricing';
import type { Product, ProductVariation } from '../types/product';

/** Fallback for variations without a stored slug: product slug plus option values. */
export function variationSlug(product: Product, variation: ProductVariation): string {
  if (variation.slug) return variation.slug;
  const optionPart = Object.values(variation.options)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return optionPart ? `${product.slug}-${optionPart}` : product.slug;
}

/** Variation-focused response with parent product context, returned when a lookup resolves to a variation. */
export async function buildVariationDetail(
  parent: Product,
  variation: ProductVariation,
  currency?: string,
) {
  return {
    productId: parent.id,
    productSlug: parent.slug,
    name: parent.name,
    description: parent.description,
    id: variation.id,
    sku: variation.sku,
    slug: variationSlug(parent, variation),
    options: variation.options,
    images: variation.images ?? parent.images,
    prices: await getVariationPriceViews(parent, variation, currency),
  };
}
