const TAX_RATE = 0.05;

export interface RestaurantTaxOptions {
  pricesIncludeGst?: boolean;
  compositeScheme?: boolean;
}

export interface OrderTaxResult {
  subtotal: number;
  taxAmount: number;
  finalAmount: number;
  subtotalLabel: string;
  showTax: boolean;
}

export interface TaxableItemLike {
  price: number;
  quantity: number;
  isTaxable?: boolean;
}

export function splitItemGross(items: TaxableItemLike[]): {
  taxableGross: number;
  nonTaxableGross: number;
} {
  return items.reduce(
    (acc, item) => {
      const line = item.price * item.quantity;
      if (item.isTaxable === false) {
        acc.nonTaxableGross += line;
      } else {
        acc.taxableGross += line;
      }
      return acc;
    },
    { taxableGross: 0, nonTaxableGross: 0 }
  );
}

/** Align with restaurant-api/internal/services/order_tax.go */
export function calculateRestaurantOrderTax(
  taxableGross: number,
  nonTaxableGross: number,
  discount: number,
  options: RestaurantTaxOptions = {}
): OrderTaxResult {
  const pricesIncludeGst = options.pricesIncludeGst ?? false;
  const compositeScheme = options.compositeScheme ?? false;

  let taxable = Math.max(0, taxableGross);
  let nonTaxable = Math.max(0, nonTaxableGross);
  let discountValue = Math.max(0, discount);
  const fullGross = taxable + nonTaxable;
  if (discountValue > fullGross) {
    discountValue = fullGross;
  }

  if (compositeScheme) {
    const finalAmount = Math.max(0, fullGross - discountValue);
    return {
      subtotal: finalAmount,
      taxAmount: 0,
      finalAmount,
      subtotalLabel: 'Subtotal',
      showTax: false,
    };
  }

  if (pricesIncludeGst) {
    const ratio = fullGross > 0 ? taxable / fullGross : 0;
    const discountedTaxable = Math.max(0, taxable - discountValue * ratio);
    const discountedNonTaxable = Math.max(0, nonTaxable - discountValue * (1 - ratio));
    const taxableValue = discountedTaxable / (1 + TAX_RATE);
    const taxAmount = discountedTaxable - taxableValue;
    const subtotal = taxableValue + discountedNonTaxable;
    const finalAmount = Math.max(0, fullGross - discountValue);
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      finalAmount: parseFloat(finalAmount.toFixed(2)),
      subtotalLabel: 'Subtotal (excl. GST)',
      showTax: taxAmount > 0,
    };
  }

  const subtotal = taxable + nonTaxable;
  const taxAmount = taxable * TAX_RATE;
  const finalAmount = Math.max(0, subtotal + taxAmount - discountValue);
  return {
    subtotal,
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    finalAmount: parseFloat(finalAmount.toFixed(2)),
    subtotalLabel: 'Subtotal',
    showTax: taxAmount > 0,
  };
}

export function calculateOrderTax(
  gross: number,
  discount: number,
  pricesIncludeGstOrOptions: boolean | RestaurantTaxOptions = false
): OrderTaxResult {
  const options =
    typeof pricesIncludeGstOrOptions === 'boolean'
      ? { pricesIncludeGst: pricesIncludeGstOrOptions }
      : pricesIncludeGstOrOptions;
  return calculateRestaurantOrderTax(gross, 0, discount, options);
}

export function subtotalLabel(pricesIncludeGst: boolean, compositeScheme = false): string {
  if (compositeScheme) return 'Subtotal';
  return pricesIncludeGst ? 'Subtotal (excl. GST)' : 'Subtotal';
}

export function taxLabel(taxRate = TAX_RATE): string {
  return `GST (${Math.round(taxRate * 100)}%)`;
}

export function shouldShowTax(options: RestaurantTaxOptions, taxAmount: number): boolean {
  if (options.compositeScheme) return false;
  return taxAmount > 0;
}
