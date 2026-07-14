export type PromotionAction =
  | { type: 'amount_off'; value: number; currency: string } // value in minor units (cents)
  | { type: 'percentage_off'; value: number }; // 0 < value <= 100

/** Cart-level condition: the promotion applies when the cart total exceeds the threshold. */
export interface PromotionCriteria {
  /** Threshold in minor units (cents); the cart currency must match `currency`. */
  cartTotalGreaterThan: number;
  currency: string;
}

export interface Promotion {
  id: string;
  /**
   * Snake_case by API contract (other fields follow the repo's camelCase). Unique across promotions.
   * Absent = system-applied: evaluated automatically against every cart, no code required.
   */
  promo_code?: string;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601, after startDate
  /** SKUs the promotion applies to; empty array = applies to all SKUs (catalog-wide). */
  skus: string[];
  /** When present the promotion is cart-level (mutually exclusive with a non-empty skus list). */
  criteria?: PromotionCriteria;
  action: PromotionAction;
  createdAt: string;
  updatedAt: string;
}
