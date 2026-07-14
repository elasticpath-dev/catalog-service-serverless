import type { Promotion } from '../types/promotion';

export interface CartLine {
  sku: string;
  /** Set when the line's price came from the variation -> parent fallback. */
  parentSku?: string;
  quantity: number;
  /** Effective unit price (salePrice ?? listPrice), minor units. */
  unitPrice: number;
  subtotal: number;
}

export interface Cart {
  lines: CartLine[];
  currency: string;
  cartTotal: number;
}

export type Evaluation =
  | { applicable: true; amount: number }
  | { applicable: false; status: 400 | 409 | 410; reason: string };

const label = (promo: Promotion) => promo.promo_code ?? promo.id;

/**
 * Evaluates one promotion against a cart. Cart-level promotions (criteria) discount the
 * cart total; item-level promotions discount the subtotal of eligible lines. A line whose
 * price fell back to the parent product also matches a promotion listing the parent sku.
 */
export function evaluatePromotion(promo: Promotion, cart: Cart, now: number): Evaluation {
  if (now < Date.parse(promo.startDate)) {
    return {
      applicable: false,
      status: 409,
      reason: `Promotion "${label(promo)}" starts at ${promo.startDate}`,
    };
  }
  if (now > Date.parse(promo.endDate)) {
    return {
      applicable: false,
      status: 410,
      reason: `Promotion "${label(promo)}" expired at ${promo.endDate}`,
    };
  }

  let base: number;
  if (promo.criteria) {
    if (promo.criteria.currency !== cart.currency) {
      return {
        applicable: false,
        status: 400,
        reason: `Promotion "${label(promo)}" applies to ${promo.criteria.currency} carts, not ${cart.currency}`,
      };
    }
    if (cart.cartTotal <= promo.criteria.cartTotalGreaterThan) {
      return {
        applicable: false,
        status: 400,
        reason: `Promotion "${label(promo)}" requires a cart total greater than ${promo.criteria.cartTotalGreaterThan}`,
      };
    }
    base = cart.cartTotal;
  } else {
    const eligible =
      promo.skus.length === 0
        ? cart.lines
        : cart.lines.filter(
            (l) =>
              promo.skus.includes(l.sku) ||
              (l.parentSku !== undefined && promo.skus.includes(l.parentSku)),
          );
    base = eligible.reduce((sum, l) => sum + l.subtotal, 0);
    if (base === 0) {
      return {
        applicable: false,
        status: 400,
        reason: `Promotion "${label(promo)}" does not apply to any item in the cart`,
      };
    }
  }

  if (promo.action.type === 'amount_off') {
    if (promo.action.currency !== cart.currency) {
      return {
        applicable: false,
        status: 400,
        reason: `Promotion "${label(promo)}" is denominated in ${promo.action.currency} and cannot be applied to ${cart.currency}`,
      };
    }
    return { applicable: true, amount: Math.min(promo.action.value, base) };
  }
  return { applicable: true, amount: Math.round((base * promo.action.value) / 100) };
}
