import type { FormattedPrice } from '../lib/formatPrice';

/** Amounts are integers in minor units (e.g. cents): 2500 = $25.00. */
export interface Price {
  /** Product sku or variation sku */
  sku: string;
  /** ISO 4217 code, e.g. USD */
  currency: string;
  listPrice: number;
  /** When present, the item is on sale: show listPrice as "was", salePrice as "now" */
  salePrice?: number;
  createdAt: string;
  updatedAt: string;
}

/** Price as attached to product/variation API responses. */
export interface PriceView {
  currency: string;
  listPrice: number;
  salePrice?: number;
  /** Display strings for the amounts above, e.g. { listPrice: "£55.00" } for GBP 5500 */
  formatted: FormattedPrice;
}
