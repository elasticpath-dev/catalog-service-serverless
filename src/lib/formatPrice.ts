/** Display strings for amounts stored in minor units, e.g. { listPrice: "£55.00" }. */
export interface FormattedPrice {
  listPrice: string;
  salePrice?: string;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: string): Intl.NumberFormat {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** 5500 + "GBP" -> "£55.00". Fraction digits come from the currency (JPY has 0, KWD has 3). */
export function formatMinorUnits(amount: number, currency: string): string {
  const formatter = formatterFor(currency);
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}

export function formatPriceFields(price: {
  currency: string;
  listPrice: number;
  salePrice?: number;
}): FormattedPrice {
  return {
    listPrice: formatMinorUnits(price.listPrice, price.currency),
    ...(price.salePrice !== undefined
      ? { salePrice: formatMinorUnits(price.salePrice, price.currency) }
      : {}),
  };
}
