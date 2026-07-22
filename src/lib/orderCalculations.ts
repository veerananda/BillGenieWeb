import { calculateRestaurantOrderTax, splitItemGross, type RestaurantTaxOptions } from './orderTax';

export interface OrderItemLike {
  price: number;
  quantity: number;
  isTaxable?: boolean;
}

export interface OrderCalculation {
  subtotal: number;
  taxAmount: number;
  discountValue: number;
  finalAmount: number;
  grossSubtotal: number;
  pricesIncludeGst: boolean;
  compositeScheme: boolean;
  showTax: boolean;
}

export function calculateOrderTotals(
  items: OrderItemLike[],
  discountAmount: string | number = 0,
  discountType: 'amount' | 'percent' = 'amount',
  options: RestaurantTaxOptions = {}
): OrderCalculation {
  const { taxableGross, nonTaxableGross } = splitItemGross(items);
  const grossSubtotal = taxableGross + nonTaxableGross;
  const discountNum = typeof discountAmount === 'string' ? parseFloat(discountAmount) || 0 : discountAmount;

  let discountValue = 0;
  if (discountType === 'percent') {
    discountValue = (grossSubtotal * discountNum) / 100;
  } else {
    discountValue = discountNum;
  }
  discountValue = Math.min(grossSubtotal, Math.max(0, discountValue));

  const tax = calculateRestaurantOrderTax(taxableGross, nonTaxableGross, discountValue, options);

  return {
    subtotal: tax.subtotal,
    taxAmount: tax.taxAmount,
    discountValue,
    finalAmount: tax.finalAmount,
    grossSubtotal,
    pricesIncludeGst: options.pricesIncludeGst ?? false,
    compositeScheme: options.compositeScheme ?? false,
    showTax: tax.showTax,
  };
}
