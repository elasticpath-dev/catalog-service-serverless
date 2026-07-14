import { ApiError, badRequest, json, notFound, parseBody, withErrorHandling } from '../../lib/response';
import { applyPromotionSchema } from '../../validation/promotion';
import { getPromotionByCode, listSystemPromotions } from '../../lib/promotionRepository';
import { getPrice } from '../../lib/priceRepository';
import { getProductByVariationSkuOrSlug } from '../../lib/productRepository';
import { formatMinorUnits } from '../../lib/formatPrice';
import { evaluatePromotion, type Cart, type CartLine } from '../../lib/promotionEngine';
import type { Promotion } from '../../types/promotion';

const errorCodeFor = (status: number) =>
  status === 404 ? 'not_found' : status === 409 ? 'conflict' : status === 410 ? 'gone' : 'bad_request';

export const handler = withErrorHandling(async (event) => {
  const parsed = applyPromotionSchema.safeParse(parseBody(event));
  if (!parsed.success) {
    throw badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const { items, currency, code } = parsed.data;

  // Price every line, with the variation -> parent fallback (same as GET /prices/{sku}).
  const lines: CartLine[] = await Promise.all(
    items.map(async ({ sku, quantity }) => {
      let price = await getPrice(sku, currency);
      let parentSku: string | undefined;
      if (!price) {
        const parent = await getProductByVariationSkuOrSlug(sku);
        if (parent && parent.sku !== sku) {
          price = await getPrice(parent.sku, currency);
          if (price) parentSku = parent.sku;
        }
      }
      if (!price) throw notFound(`No ${currency} price found for sku "${sku}"`);
      const unitPrice = price.salePrice ?? price.listPrice;
      return { sku, ...(parentSku ? { parentSku } : {}), quantity, unitPrice, subtotal: unitPrice * quantity };
    }),
  );
  const cart: Cart = {
    lines,
    currency,
    cartTotal: lines.reduce((sum, l) => sum + l.subtotal, 0),
  };

  const now = Date.now();
  let codePromotion: Promotion | undefined;
  if (code) {
    codePromotion = await getPromotionByCode(code);
    if (!codePromotion) throw notFound(`Promotion with code "${code}" not found`);
  }

  // An explicitly entered code that fails is a hard error; system promos that don't match are skipped.
  let best: { promotion: Promotion; amount: number } | undefined;
  if (codePromotion) {
    const result = evaluatePromotion(codePromotion, cart, now);
    if (!result.applicable) throw new ApiError(result.status, errorCodeFor(result.status), result.reason);
    best = { promotion: codePromotion, amount: result.amount };
  }
  for (const promo of await listSystemPromotions()) {
    const result = evaluatePromotion(promo, cart, now);
    // Strictly greater: on a tie the entered code (evaluated first) wins.
    if (result.applicable && result.amount > (best?.amount ?? 0)) {
      best = { promotion: promo, amount: result.amount };
    }
  }

  const amount = best?.amount ?? 0;
  const total = cart.cartTotal - amount;
  return json(200, {
    items: lines.map(({ sku, quantity, unitPrice, subtotal }) => ({ sku, quantity, unitPrice, subtotal })),
    currency,
    cartSubtotal: cart.cartTotal,
    amount,
    total,
    appliedPromotion: best
      ? {
          id: best.promotion.id,
          ...(best.promotion.promo_code ? { promo_code: best.promotion.promo_code } : {}),
          action: best.promotion.action,
        }
      : null,
    message: best
      ? `Promotion ${best.promotion.promo_code ?? best.promotion.id} applied`
      : 'No promotion applied',
    formatted: { amount: formatMinorUnits(amount, currency), total: formatMinorUnits(total, currency) },
  });
});
