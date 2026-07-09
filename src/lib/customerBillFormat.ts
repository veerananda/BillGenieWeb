import type { Order, RestaurantProfile } from '../services/api';
import { subtotalLabel, taxLabel } from './orderTax';

export interface CustomerBillLineItem {
  name: string;
  quantity: number;
  total: number;
}

export interface CustomerBillData {
  restaurantName?: string;
  address?: string;
  contactNumber?: string;
  orderNumber?: number | string;
  tableNumber?: string;
  customerName?: string;
  createdAt?: string | number;
  items: CustomerBillLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  pricesIncludeGst?: boolean;
  paymentMethod?: string;
  isPaid?: boolean;
}

function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

function formatDateTime(value?: string | number): string {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCustomerBillHtml(data: CustomerBillData): string {
  const title = escapeHtml(data.restaurantName || 'Bill Summary');
  const metaParts: string[] = [];
  if (data.orderNumber) metaParts.push(`Order #${escapeHtml(String(data.orderNumber))}`);
  if (data.tableNumber) metaParts.push(`Table ${escapeHtml(data.tableNumber)}`);
  const meta = metaParts.join(' · ');
  const dateLine = formatDateTime(data.createdAt);
  const customer =
    data.customerName &&
    data.customerName !== 'Guest' &&
    data.customerName !== 'Takeaway' &&
    data.customerName !== 'Counter' &&
    data.customerName !== 'Self Service'
      ? escapeHtml(data.customerName)
      : '';

  const itemRows = data.items
    .map(
      (item) => `
        <tr>
          <td class="item-name">${escapeHtml(item.name)}</td>
          <td class="qty">${item.quantity}</td>
          <td class="amount">${formatCurrency(item.total)}</td>
        </tr>`
    )
    .join('');

  const subtotalRow =
    data.subtotal > 0
      ? `<div class="row"><span>${subtotalLabel(Boolean(data.pricesIncludeGst))}</span><span>${formatCurrency(data.subtotal)}</span></div>`
      : '';
  const taxRow =
    data.taxAmount > 0
      ? `<div class="row"><span>${taxLabel()}</span><span>${formatCurrency(data.taxAmount)}</span></div>`
      : '';
  const discountRow =
    data.discountAmount > 0
      ? `<div class="row discount"><span>Discount</span><span>-${formatCurrency(data.discountAmount)}</span></div>`
      : '';
  const paymentRow =
    data.isPaid && data.paymentMethod
      ? `<div class="row"><span>Payment</span><span>${escapeHtml(data.paymentMethod.toUpperCase())}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bill ${escapeHtml(String(data.orderNumber || ''))}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px 16px;
      background: #f8fafc;
      color: #0f172a;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .sheet {
      max-width: 420px;
      margin: 0 auto;
      background: #fff;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }
    .head {
      padding: 24px 20px 18px;
      text-align: center;
      background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
      border-bottom: 1px solid #e2e8f0;
    }
    .brand {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .head h1 {
      margin: 0;
      font-size: 1.35rem;
      line-height: 1.3;
    }
    .meta, .date, .customer {
      margin: 6px 0 0;
      color: #64748b;
      font-size: 0.92rem;
    }
    .body { padding: 18px 20px 24px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    th {
      text-align: left;
      color: #94a3b8;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    th.qty, th.amount, td.qty, td.amount { text-align: right; }
    td {
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .item-name { padding-right: 10px; font-weight: 500; }
    .totals {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 5px 0;
      color: #475569;
      font-size: 0.95rem;
    }
    .row.discount { color: #16a34a; }
    .row.total {
      margin-top: 10px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 1.2rem;
      font-weight: 800;
      color: #0f172a;
    }
    .footer {
      margin-top: 18px;
      text-align: center;
      color: #94a3b8;
      font-size: 0.85rem;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border: none; border-radius: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="brand">Bill Summary</div>
      <h1>${title}</h1>
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      ${dateLine ? `<p class="date">${escapeHtml(dateLine)}</p>` : ''}
      ${customer ? `<p class="customer">Customer: ${customer}</p>` : ''}
    </div>
    <div class="body">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="qty">Qty</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="totals">
        ${subtotalRow}
        ${taxRow}
        ${discountRow}
        <div class="row total"><span>Total</span><span>${formatCurrency(data.total)}</span></div>
        ${paymentRow}
      </div>
      <p class="footer">Thank you for dining with us.</p>
    </div>
  </div>
</body>
</html>`;
}

export function buildCustomerBillFromOrder(
  order: Order,
  profile: RestaurantProfile | null | undefined,
  totals: {
    subtotal: number;
    taxAmount: number;
    discountValue: number;
    finalAmount: number;
    pricesIncludeGst: boolean;
  },
  items: CustomerBillLineItem[],
): string {
  return buildCustomerBillHtml({
    restaurantName: profile?.name,
    address: profile?.address,
    contactNumber: profile?.contact_number || profile?.phone,
    orderNumber: order.order_number,
    tableNumber: String(order.table_number),
    customerName: order.customer_name,
    createdAt: order.created_at,
    items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountValue,
    total: totals.finalAmount,
    pricesIncludeGst: totals.pricesIncludeGst,
    isPaid: false,
  });
}

export function printBillHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  const doc = frame.contentDocument ?? frame.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  frame.contentWindow?.focus();
  frame.contentWindow?.print();

  setTimeout(() => {
    document.body.removeChild(frame);
  }, 1000);
}
