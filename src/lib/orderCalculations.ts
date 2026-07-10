import { calculateOrderTax } from './orderTax';

export interface OrderItemLike {
  price: number;
  quantity: number;
}

export interface OrderCalculation {
  subtotal: number;
  taxAmount: number;
  discountValue: number;
  finalAmount: number;
  grossSubtotal: number;
  pricesIncludeGst: boolean;
}

export function calculateOrderTotals(
  items: OrderItemLike[],
  discountAmount: string | number = 0,
  discountType: 'amount' | 'percent' = 'amount',
  options: { pricesIncludeGst?: boolean } = {}
): OrderCalculation {
  const grossSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountNum = typeof discountAmount === 'string' ? parseFloat(discountAmount) || 0 : discountAmount;

  let discountValue = 0;
  if (discountType === 'percent') {
    discountValue = (grossSubtotal * discountNum) / 100;
  } else {
    discountValue = discountNum;
  }
  discountValue = Math.min(grossSubtotal, Math.max(0, discountValue));

  const tax = calculateOrderTax(grossSubtotal, discountValue, options.pricesIncludeGst ?? false);

  return {
    subtotal: tax.subtotal,
    taxAmount: tax.taxAmount,
    discountValue,
    finalAmount: tax.finalAmount,
    grossSubtotal,
    pricesIncludeGst: options.pricesIncludeGst ?? false,
  };
}
