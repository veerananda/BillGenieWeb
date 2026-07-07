const TAX_RATE = 0.05;

export interface OrderTaxResult {
  subtotal: number;
  taxAmount: number;
  finalAmount: number;
  subtotalLabel: string;
}

export function calculateOrderTax(
  gross: number,
  discount: number,
  pricesIncludeGst: boolean
): OrderTaxResult {
  const net = Math.max(0, gross - discount);
  if (pricesIncludeGst) {
    // Prices already include GST — back-calculate the pre-tax base
    const subtotal = net / (1 + TAX_RATE);
    const taxAmount = net - subtotal;
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      finalAmount: parseFloat(net.toFixed(2)),
      subtotalLabel: 'Subtotal (excl. GST)',
    };
  } else {
    // Prices exclude GST — add 5% on top
    const taxAmount = gross * TAX_RATE;
    const finalAmount = Math.max(0, gross + taxAmount - discount);
    return {
      subtotal: gross,
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      finalAmount: parseFloat(finalAmount.toFixed(2)),
      subtotalLabel: 'Subtotal',
    };
  }
}
