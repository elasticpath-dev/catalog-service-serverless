export interface ProductVariation {
  id: string;
  /** Variation sku, unique within the product (e.g. CLO-TEE-001-RED-M) */
  sku: string;
  /** Variation slug (e.g. classic-tee-red-m); optional, derived from the product slug + options when absent */
  slug?: string;
  /** Option values that define the variation, e.g. { size: "M", color: "Red" } */
  options: Record<string, string>;
  /** Optional variation-specific images (falls back to the product images) */
  images?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  slug: string;
  images: string[];
  attributes: Record<string, string>;
  categoryIds: string[];
  variations: ProductVariation[];
  createdAt: string;
  updatedAt: string;
}
