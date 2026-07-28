import type { Order, RestaurantProfile } from '../services/api';
import { subtotalLabel, taxLabel } from './orderTax';

export interface CustomerBillLineItem {
  name: string;
  quantity: number;
  /** Unit price (rate). */
  unitRate?: number;
  total: number;
  notes?: string;
}

export interface CustomerBillData {
  restaurantName?: string;
  address?: string;
  contactNumber?: string;
  gstNumber?: string;
  orderNumber?: number | string;
  tableNumber?: string;
  customerName?: string;
  attendedByName?: string;
  createdAt?: string | number;
  items: CustomerBillLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  pricesIncludeGst?: boolean;
  compositeScheme?: boolean;
  paymentMethod?: string;
  isPaid?: boolean;
  /** 58mm → 32 cols (default), 80mm → 48 cols */
  paperWidthMm?: 58 | 80;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Fixed right block: Qty(3) + sp + Rate(7) + sp + Price(7) = 19 */
const RIGHT_BLOCK = 19;

export function thermalWidthForPaper(paperWidthMm: 58 | 80 = 58): number {
  return paperWidthMm === 80 ? 48 : 32;
}

/** ASCII-safe money for thermal printers (no ₹). */
export function formatBillMoney(amount: number, withRs = false): string {
  const n = Number(amount || 0).toFixed(2);
  return withRs ? `Rs.${n}` : n;
}

/** ASCII 12h datetime — avoids locale narrow-space before AM/PM. */
export function formatBillDateTime(value?: string | number): string {
  if (!value) return '';
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day} ${month} ${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function padThermalLine(left: string, right: string, width: number): string {
  const r = right.length > width ? right.slice(right.length - width) : right;
  const maxLeft = Math.max(0, width - r.length - 1);
  let l = left;
  if (l.length > maxLeft) {
    l = maxLeft <= 1 ? '' : `${l.slice(0, maxLeft - 1)}.`;
  }
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(spaces)}${r}`;
}

function centerThermalLine(text: string, width: number): string {
  const t = text.length > width ? text.slice(0, width) : text;
  const pad = Math.max(0, width - t.length);
  const left = Math.floor(pad / 2);
  return `${' '.repeat(left)}${t}`;
}

function wrapWords(text: string, width: number): string[] {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [''];
  if (width <= 0) return [text];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        // Hard-split oversized tokens.
        let rest = word;
        while (rest.length > width) {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      }
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      if (word.length <= width) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > width) {
          lines.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatQty(qty: number): string {
  return String(Math.round(qty) === qty ? qty : Number(qty).toFixed(2)).slice(0, 3).padStart(3, ' ');
}

function formatAmountCol(amount: number): string {
  return formatBillMoney(amount).slice(0, 7).padStart(7, ' ');
}

/** One header line + item lines with name wrap; Qty/Rate/Price stay on first line. */
export function formatThermalItemBlock(
  items: CustomerBillLineItem[],
  width: number,
): string[] {
  const nameWidth = Math.max(8, width - RIGHT_BLOCK);
  const lines: string[] = [
    `${'Item'.padEnd(nameWidth)}${'Qty'.padStart(3)} ${'Rate'.padStart(7)} ${'Price'.padStart(7)}`,
  ];

  items.forEach((item) => {
    const rate = lineUnitRate(item);
    const right = `${formatQty(item.quantity)} ${formatAmountCol(rate)} ${formatAmountCol(item.total)}`;
    const nameLines = wrapWords(item.name, nameWidth);
    const first = (nameLines[0] || '').padEnd(nameWidth).slice(0, nameWidth);
    lines.push(`${first}${right}`);
    for (let i = 1; i < nameLines.length; i += 1) {
      lines.push(nameLines[i].slice(0, nameWidth));
    }
    if (item.notes) {
      lines.push(`  Notes: ${item.notes}`.slice(0, width));
    }
  });

  return lines;
}

function lineUnitRate(item: CustomerBillLineItem): number {
  if (item.unitRate != null && item.unitRate > 0) return item.unitRate;
  if (item.quantity > 0) return item.total / item.quantity;
  return 0;
}

export function buildCustomerBillHtml(data: CustomerBillData): string {
  const title = escapeHtml(data.restaurantName || 'Bill Summary');
  const metaParts: string[] = [];
  if (data.orderNumber) metaParts.push(`Order #${escapeHtml(String(data.orderNumber))}`);
  if (data.tableNumber) metaParts.push(`Table ${escapeHtml(data.tableNumber)}`);
  const meta = metaParts.join(' · ');
  const dateLine = formatBillDateTime(data.createdAt);
  const customer =
    data.customerName &&
    data.customerName !== 'Guest' &&
    data.customerName !== 'Takeaway' &&
    data.customerName !== 'Counter' &&
    data.customerName !== 'Self Service'
      ? escapeHtml(data.customerName)
      : '';
  const attendedBy = data.attendedByName ? escapeHtml(data.attendedByName) : '';
  const address = data.address ? escapeHtml(data.address) : '';
  const contact = data.contactNumber ? escapeHtml(data.contactNumber) : '';
  const gst = data.gstNumber ? escapeHtml(data.gstNumber) : '';

  const itemRows = data.items
    .map((item) => {
      const rate = lineUnitRate(item);
      return `
        <tr>
          <td class="item-name">${escapeHtml(item.name)}</td>
          <td class="qty">${item.quantity}</td>
          <td class="rate">${formatBillMoney(rate)}</td>
          <td class="amount">${formatBillMoney(item.total)}</td>
        </tr>`;
    })
    .join('');

  const subtotalRow =
    data.subtotal > 0 && !data.compositeScheme
      ? `<div class="row"><span>${subtotalLabel(Boolean(data.pricesIncludeGst), Boolean(data.compositeScheme))}</span><span>${formatBillMoney(data.subtotal, true)}</span></div>`
      : '';
  const taxRow =
    data.taxAmount > 0 && !data.compositeScheme
      ? `<div class="row"><span>${taxLabel()}</span><span>${formatBillMoney(data.taxAmount, true)}</span></div>`
      : '';
  const discountRow =
    data.discountAmount > 0
      ? `<div class="row discount"><span>Discount</span><span>-${formatBillMoney(data.discountAmount, true)}</span></div>`
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
      padding: 16px;
      background: #fff;
      color: #111;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .sheet { max-width: 420px; margin: 0 auto; }
    .head { text-align: center; margin-bottom: 12px; }
    .head h1 { margin: 0 0 6px; font-size: 1.15rem; }
    .meta, .date, .customer { margin: 2px 0; color: #333; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th {
      text-align: left;
      border-bottom: 1px solid #ccc;
      padding: 6px 0;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    th.qty, th.rate, th.amount, td.qty, td.rate, td.amount { text-align: right; white-space: nowrap; }
    th.qty, td.qty { width: 12%; }
    th.rate, td.rate { width: 18%; padding-left: 8px; }
    th.amount, td.amount { width: 22%; padding-left: 8px; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; vertical-align: top; }
    .item-name { padding-right: 8px; word-break: break-word; }
    .totals { margin-top: 12px; border-top: 1px solid #ccc; padding-top: 8px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 0.9rem; }
    .row.discount { color: #15803d; }
    .row.total { margin-top: 6px; padding-top: 8px; border-top: 1px solid #ccc; font-size: 1.05rem; font-weight: 700; }
    .footer { margin-top: 14px; text-align: center; color: #666; font-size: 0.85rem; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>${title}</h1>
      ${address ? `<p class="meta">${address}</p>` : ''}
      ${contact ? `<p class="meta">${contact}</p>` : ''}
      ${gst ? `<p class="meta">GSTIN: ${gst}</p>` : ''}
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      ${dateLine ? `<p class="date">${escapeHtml(dateLine)}</p>` : ''}
      ${customer ? `<p class="customer">Customer: ${customer}</p>` : ''}
      ${attendedBy ? `<p class="customer">Attended by: ${attendedBy}</p>` : ''}
    </div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="qty">Qty</th>
          <th class="rate">Rate</th>
          <th class="amount">Price</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      ${subtotalRow}
      ${taxRow}
      ${discountRow}
      <div class="row total"><span>TOTAL</span><span>${formatBillMoney(data.total, true)}</span></div>
      ${paymentRow}
    </div>
    <p class="footer">Thank you!</p>
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
    compositeScheme?: boolean;
    attendedByName?: string;
  },
  items: CustomerBillLineItem[],
): string {
  return buildCustomerBillHtml(orderBillData(order, profile, totals, items));
}

export function buildCustomerBillTextFromOrder(
  order: Order,
  profile: RestaurantProfile | null | undefined,
  totals: {
    subtotal: number;
    taxAmount: number;
    discountValue: number;
    finalAmount: number;
    pricesIncludeGst: boolean;
    compositeScheme?: boolean;
    attendedByName?: string;
  },
  items: CustomerBillLineItem[],
): string {
  return buildCustomerBillText(orderBillData(order, profile, totals, items));
}

function orderBillData(
  order: Order,
  profile: RestaurantProfile | null | undefined,
  totals: {
    subtotal: number;
    taxAmount: number;
    discountValue: number;
    finalAmount: number;
    pricesIncludeGst: boolean;
    compositeScheme?: boolean;
    attendedByName?: string;
  },
  items: CustomerBillLineItem[],
): CustomerBillData {
  return {
    restaurantName: profile?.name,
    address: profile?.address,
    contactNumber: profile?.contact_number || profile?.phone,
    gstNumber: profile?.gst_number,
    orderNumber: order.order_number,
    tableNumber: String(order.table_number),
    customerName: order.customer_name,
    attendedByName: totals.attendedByName,
    createdAt: order.created_at,
    items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountValue,
    total: totals.finalAmount,
    pricesIncludeGst: totals.pricesIncludeGst,
    compositeScheme: totals.compositeScheme,
    isPaid: false,
  };
}

/** Plain-text bill for ESC/POS thermal printers (browser BT/serial or print agent). */
export function buildCustomerBillText(data: CustomerBillData): string {
  const width = thermalWidthForPaper(data.paperWidthMm ?? 58);
  const divider = '-'.repeat(width);
  const lines: string[] = [];

  if (data.restaurantName) {
    lines.push(centerThermalLine(data.restaurantName, width));
    if (data.address) {
      wrapWords(data.address, width).forEach((line) => lines.push(centerThermalLine(line, width)));
    }
    if (data.contactNumber) lines.push(centerThermalLine(`Ph: ${data.contactNumber}`, width));
    if (data.gstNumber) lines.push(centerThermalLine(`GSTIN: ${data.gstNumber}`, width));
  }

  lines.push(divider);
  if (data.orderNumber) lines.push(`Order: #${data.orderNumber}`);
  if (data.tableNumber) lines.push(`Table: ${data.tableNumber}`);

  const customer =
    data.customerName &&
    data.customerName !== 'Guest' &&
    data.customerName !== 'Takeaway' &&
    data.customerName !== 'Counter' &&
    data.customerName !== 'Self Service'
      ? data.customerName
      : '';
  if (customer) lines.push(`Customer: ${customer}`);
  if (data.attendedByName) lines.push(`Attended by: ${data.attendedByName}`);

  const dateLine = formatBillDateTime(data.createdAt);
  if (dateLine) lines.push(`Date: ${dateLine}`);

  lines.push(divider);
  lines.push(...formatThermalItemBlock(data.items, width));
  lines.push(divider);

  if (data.subtotal > 0 && !data.compositeScheme) {
    lines.push(
      padThermalLine(
        subtotalLabel(Boolean(data.pricesIncludeGst), Boolean(data.compositeScheme)),
        formatBillMoney(data.subtotal),
        width,
      ),
    );
  }
  if (data.taxAmount > 0 && !data.compositeScheme) {
    lines.push(padThermalLine(taxLabel(), formatBillMoney(data.taxAmount), width));
  }
  if (data.discountAmount > 0) {
    lines.push(padThermalLine('Discount', `-${formatBillMoney(data.discountAmount)}`, width));
  }
  lines.push(padThermalLine('TOTAL', formatBillMoney(data.total, true), width));

  if (data.isPaid && data.paymentMethod) {
    lines.push(`Payment: ${data.paymentMethod.toUpperCase()}`);
  }

  lines.push(divider);
  lines.push(centerThermalLine('Thank you!', width));
  return lines.join('\n');
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
