export type PaymentReceiptRow = { label: string; value: string };

export type ReceiptPaymentSource = {
  payment_method?: string;
  amount_received?: number;
  change_returned?: number;
  cash_amount?: number;
  upi_amount?: number;
};

export function getPaymentMethodLabel(order: ReceiptPaymentSource): string {
  return (order.payment_method || '').toUpperCase();
}

/** Payment lines for receipt UI and share/print text — matches mobile OrderReceiptScreen. */
export function getPaymentReceiptRows(
  order: ReceiptPaymentSource,
  formatCurrency: (amount: number) => string,
): PaymentReceiptRow[] {
  const payment = getPaymentMethodLabel(order);
  if (!payment) return [];

  const rows: PaymentReceiptRow[] = [
    { label: 'Payment', value: payment === 'SPLIT' ? 'SPLIT' : payment },
  ];

  const received = Number(order.amount_received ?? 0);
  const change = Number(order.change_returned ?? 0);
  const cashPaid = Number(order.cash_amount ?? 0);
  const upiPaid = Number(order.upi_amount ?? 0);

  if (payment === 'SPLIT') {
    if (cashPaid > 0) {
      rows.push({ label: 'Paid in cash', value: formatCurrency(cashPaid) });
      if (change > 0) {
        rows.push({ label: 'Change returned', value: formatCurrency(change) });
      }
    }
    if (upiPaid > 0) {
      rows.push({ label: 'Paid in UPI', value: formatCurrency(upiPaid) });
    }
  } else if (payment === 'CASH' && received > 0) {
    rows.push({ label: 'Received', value: formatCurrency(received) });
    if (change > 0) {
      rows.push({ label: 'Change', value: formatCurrency(change) });
    }
  }

  return rows;
}

export function appendPaymentReceiptText(
  lines: string[],
  order: ReceiptPaymentSource,
  formatCurrency: (amount: number) => string,
): void {
  for (const row of getPaymentReceiptRows(order, formatCurrency)) {
    if (row.label === 'Payment') {
      lines.push(`Payment: ${row.value}`);
    } else {
      lines.push(`${row.label}: ${row.value}`);
    }
  }
}
