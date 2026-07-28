import { useCallback, useEffect, useState } from 'react';
import { History as HistoryIcon, Printer, Share2 } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order, RestaurantProfile } from '../../services/api';
import { formatBillMoney, formatBillDateTime, formatThermalItemBlock, thermalWidthForPaper, printBillHtml } from '../../lib/customerBillFormat';
import { getPaperWidthMm } from '../../lib/browserThermalPrinter';
import { printBillSmart } from '../../lib/printBillSmart';
import { useAppSelector } from '../../store/hooks';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits } from '../../lib/subscriptionLimits';
import { PageHeader } from '../../components/app/PageHeader';
import { Modal } from '../../components/app/Modal';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';
import { appendPaymentReceiptText, getPaymentReceiptRows } from '../../lib/receiptPaymentDetails';
import { resolveOrderItemParts } from '../../lib/orderHelpers';

// ─── Types & constants ────────────────────────────────────────────────────────

type HistoryPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'range';
type OrderTypeTab = 'dine_in' | 'counter';

const PAGE_SIZE = 50;

const FIXED_PERIODS: { key: Exclude<HistoryPeriod, 'range'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return formatBillMoney(Number(n || 0), true);
}

function formatDateTime(value?: string | null): string {
  return formatBillDateTime(value || undefined);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateRange(period: Exclude<HistoryPeriod, 'range'>): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = isoDate(today);
  if (period === 'today') return { from: to, to };
  if (period === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    const y = isoDate(d);
    return { from: y, to: y };
  }
  if (period === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return { from: isoDate(d), to };
  }
  // month = first day of current month
  const d = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: isoDate(d), to };
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function isCounter(order: Order): boolean {
  return order.order_type === 'counter';
}

function getCounterLabel(order: Order): string {
  return String(order.ticket_number ?? order.order_number ?? '?');
}

function getServiceModeLabel(order: Order): string {
  return order.service_mode === 'takeaway' ? 'Takeaway' : 'Eat here';
}

function getOrderTitle(order: Order): string {
  if (isCounter(order)) {
    return `Order #${getCounterLabel(order)}`;
  }
  return `Table ${order.table_number}`;
}

type ReceiptLineItem = {
  key: string;
  name: string;
  category: string;
  notes?: string;
  quantity: number;
  unitRate: number;
  total: number;
};

function groupReceiptItems(
  items: NonNullable<Order['items']>,
  categoryBlocklist: string[] = [],
): ReceiptLineItem[] {
  const grouped = new Map<string, ReceiptLineItem>();
  const opts = { categoryBlocklist };

  items.forEach((item) => {
    const parts = resolveOrderItemParts(item, undefined, opts);
    const unitRate = Number(item.unit_rate || item.menu_item?.price || 0);
    const notes = item.notes?.trim();
    const displayName = parts.displayName;
    const key = [
      item.menu_id || parts.name,
      displayName,
      parts.category,
      item.variant_id || item.variant_label || '',
      unitRate,
      notes || '',
    ].join('::');
    const quantity = Number(item.quantity || 0);
    const total = Number(item.total || unitRate * quantity);
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity += quantity;
      existing.total += total;
      return;
    }

    grouped.set(key, {
      key,
      name: displayName,
      category: parts.category,
      notes,
      quantity,
      unitRate,
      total,
    });
  });

  return Array.from(grouped.values());
}

function formatOrderTime(order: Order): string {
  const raw = order.completed_at || order.updated_at || order.created_at;
  return formatBillDateTime(raw || undefined);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptText(
  order: Order,
  restaurant: RestaurantProfile | null | undefined,
  receiptItems: ReceiptLineItem[],
  paperWidthMm: 58 | 80 = 58,
): string {
  const width = thermalWidthForPaper(paperWidthMm);
  const counter = isCounter(order);
  const completedAt = order.completed_at || order.updated_at || order.created_at;
  const restaurantContact = restaurant?.contact_number || restaurant?.phone;
  const showCustomer = counter
    ? !!order.customer_name && !['Takeaway', 'Counter', 'Self Service'].includes(order.customer_name)
    : !!order.customer_name;
  const lines: string[] = [];
  const divider = '-'.repeat(width);

  if (restaurant?.name) {
    lines.push(restaurant.name);
    if (restaurant.address) lines.push(restaurant.address);
    if (restaurantContact) lines.push(restaurantContact);
    if (restaurant.gst_number) lines.push(`GSTIN: ${restaurant.gst_number}`);
    lines.push('');
  }

  lines.push('RECEIPT');
  lines.push(divider);
  lines.push(getOrderTitle(order));
  lines.push(counter ? getServiceModeLabel(order) : `Order #${order.order_number}`);
  if (completedAt) lines.push(formatDateTime(completedAt));
  if (showCustomer) lines.push(`Customer: ${order.customer_name}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);
  lines.push(divider);
  lines.push(
    ...formatThermalItemBlock(
      receiptItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitRate: item.unitRate,
        total: item.total,
        notes: item.notes,
      })),
      width,
    ),
  );

  lines.push(divider);
  if (order.sub_total > 0) lines.push(`Subtotal: ${formatBillMoney(order.sub_total)}`);
  if (Number(order.tax_amount) > 0) lines.push(`Tax: ${formatBillMoney(Number(order.tax_amount))}`);
  if (Number(order.discount_amount) > 0) {
    lines.push(`Discount: -${formatBillMoney(Number(order.discount_amount))}`);
  }
  lines.push(`TOTAL: ${formatBillMoney(order.total, true)}`);
  appendPaymentReceiptText(lines, order, (n) => formatBillMoney(Number(n || 0), true));
  if (order.notes) {
    lines.push(divider);
    lines.push(`Notes: ${order.notes}`);
  }

  lines.push(divider);
  lines.push('Thank you!');

  return lines.join('\n');
}

function buildReceiptHtml(text: string, order: Order, paperWidthMm: 58 | 80 = 58): string {
  const escaped = escapeHtml(text).replace(/\n/g, '<br/>');
  const sheetMm = paperWidthMm === 80 ? 72 : 48;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${escapeHtml(String(order.order_number || ''))}</title>
  <style>
    @page { size: ${paperWidthMm}mm auto; margin: 2mm; }
    body { margin: 0; padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111827; font-size: ${paperWidthMm === 80 ? 12 : 11}px; line-height: 1.35; }
    .receipt { width: ${sheetMm}mm; max-width: 100%; margin: 0 auto; white-space: pre-wrap; }
    @media print { body { padding: 0; } .receipt { width: ${sheetMm}mm; } }
  </style>
</head>
<body>
  <div class="receipt">${escaped}</div>
</body>
</html>`;
}

function buildCombinedReceiptHtml(
  orders: Order[],
  restaurant: RestaurantProfile | null | undefined,
  paperWidthMm: 58 | 80 = 58,
): string {
  const sheetMm = paperWidthMm === 80 ? 72 : 48;
  const blocks = orders
    .map((order) => {
      const receiptItems = groupReceiptItems(
        order.items ?? [],
        restaurant?.category_display_blocklist ?? [],
      );
      const text = buildReceiptText(order, restaurant, receiptItems, paperWidthMm);
      const escaped = escapeHtml(text).replace(/\n/g, '<br/>');
      return `<div class="receipt">${escaped}</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Order history receipts</title>
  <style>
    @page { size: ${paperWidthMm}mm auto; margin: 2mm; }
    body { margin: 0; padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111827; font-size: ${paperWidthMm === 80 ? 12 : 11}px; line-height: 1.35; }
    .receipt { width: ${sheetMm}mm; max-width: 100%; margin: 0 auto 16px; white-space: pre-wrap; page-break-after: always; }
    .receipt:last-child { page-break-after: auto; margin-bottom: 0; }
    @media print { body { padding: 0; } .receipt { width: ${sheetMm}mm; } }
  </style>
</head>
<body>
${blocks}
</body>
</html>`;
}

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({
  order,
  open,
  onClose,
  restaurant,
}: {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  restaurant?: RestaurantProfile | null;
}) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!order) return null;

  const counter = isCounter(order);
  const title = getOrderTitle(order);
  const completedAt = order.completed_at || order.updated_at || order.created_at;
  const restaurantContact = restaurant?.contact_number || restaurant?.phone;
  const receiptItems = groupReceiptItems(
    order.items ?? [],
    restaurant?.category_display_blocklist ?? [],
  );
  const paymentRows = getPaymentReceiptRows(order, fmt);
  const paperWidthMm = getPaperWidthMm('bill');
  const receiptText = buildReceiptText(order, restaurant, receiptItems, paperWidthMm);

  // On counter orders, skip generic placeholder names
  const showCustomer = counter
    ? !!order.customer_name && !['Takeaway', 'Counter', 'Self Service'].includes(order.customer_name)
    : !!order.customer_name;

  const handleShareReceipt = async () => {
    setActionMessage(null);
    try {
      if (navigator.share) {
        await navigator.share({
          title: getOrderTitle(order),
          text: receiptText,
        });
        return;
      }

      await navigator.clipboard.writeText(receiptText);
      setActionMessage('Receipt copied to clipboard.');
    } catch (error) {
      console.error('Could not share receipt:', error);
      setActionMessage('Could not share receipt.');
    }
  };

  const handlePrintReceipt = () => {
    setActionMessage(null);
    void printBillSmart({
      html: buildReceiptHtml(receiptText, order, paperWidthMm),
      text: receiptText,
      orderId: order.id,
    }).then((result) => {
      if (result === 'none') {
        setActionMessage('Could not reach a bill printer. Pair one in Printers or check agent settings.');
      }
    });
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <div className="space-y-5">
        {restaurant?.name ? (
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-900">{restaurant.name}</h3>
            {restaurant.address ? (
              <p className="mt-1 text-sm text-gray-500">{restaurant.address}</p>
            ) : null}
            {restaurantContact ? (
              <p className="text-sm text-gray-500">{restaurantContact}</p>
            ) : null}
          </div>
        ) : null}

        {/* Receipt label */}
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Receipt</p>

        {/* Order identity */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>{counter ? getServiceModeLabel(order) : `Order #${order.order_number}`}</span>
          </div>
          {completedAt && <p className="text-sm text-gray-500">{formatDateTime(completedAt)}</p>}
          {showCustomer && <p className="text-sm text-gray-500">Customer: {order.customer_name}</p>}
          {order.customer_phone && <p className="text-sm text-gray-500">Phone: {order.customer_phone}</p>}
        </div>

        <div className="border-t border-gray-100" />

        {/* Line items */}
        <div className="space-y-4">
          {receiptItems.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {item.name}
                  {item.notes && (
                    <span className="ml-1 text-xs font-normal italic text-amber-600">({item.notes})</span>
                  )}
                </p>
                {item.category &&
                !item.name.toLowerCase().includes(item.category.toLowerCase()) ? (
                  <p className="mt-0.5 text-xs text-gray-400">{item.category}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-gray-400">
                  {item.quantity} × {fmt(item.unitRate)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-gray-900">{fmt(item.total)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100" />

        {/* Totals */}
        <div className="space-y-2 text-sm">
          {order.sub_total > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{fmt(order.sub_total)}</span>
            </div>
          )}
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-700">{fmt(order.tax_amount)}</span>
            </div>
          )}
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Discount</span>
              <span className="text-green-600">−{fmt(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2">
            <span className="text-base font-bold text-gray-900">Total</span>
            <span className="text-lg font-bold text-primary">{fmt(order.total)}</span>
          </div>
          {paymentRows.map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-semibold text-gray-700">{row.value}</span>
            </div>
          ))}
        </div>

        {order.notes && (
          <>
            <div className="border-t border-gray-100" />
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400">Notes</p>
              <p className="text-sm text-gray-700">{order.notes}</p>
            </div>
          </>
        )}

        <div className="border-t border-gray-100 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleShareReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
          {actionMessage ? (
            <p className="mt-2 text-center text-xs text-gray-500">{actionMessage}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const payment = (order.payment_method || '').toUpperCase();
  const counter = isCounter(order);

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-primary/5"
    >
      <td className="px-4 py-3.5 font-semibold text-gray-900">
        {getOrderTitle(order)}
      </td>
      <td className="px-4 py-3.5 text-gray-500">
        {counter ? getServiceModeLabel(order) : `#${order.order_number}`}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-gray-500">
        {formatOrderTime(order)}
      </td>
      <td className="px-4 py-3.5">
        {payment ? (
          <span className="rounded-md bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
            {payment}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-primary">
        {fmt(order.total)}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function History() {
  const profile = useAppSelector(selectProfile);
  const limits = parseSubscriptionLimits(
    (profile?.subscription_limits as Record<string, unknown> | undefined) ??
      (profile?.subscription_config as Record<string, unknown> | undefined) ??
      null
  );
  const hasExtendedHistory = limits.history_days > 30;
  const todayIso = isoDate(new Date());
  const defaultRange = getDateRange('month');

  const [period, setPeriod] = useState<HistoryPeriod>('today');
  const [orderType, setOrderType] = useState<OrderTypeTab>('dine_in');
  const [customFrom, setCustomFrom] = useState(defaultRange.from);
  const [customTo, setCustomTo] = useState(defaultRange.to);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [printingAll, setPrintingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(
    async (fromOffset: number) => {
      const range =
        period === 'range'
          ? { from: customFrom, to: customTo }
          : getDateRange(period);
      const isReset = fromOffset === 0;
      const validRange =
        period !== 'range' ||
        (isValidIsoDate(range.from) && isValidIsoDate(range.to) && range.from <= range.to);

      if (isReset) { setLoading(true); setError(null); setOrders([]); setTotal(0); }
      else setLoadingMore(true);

      if (!validRange) {
        if (isReset) setError('Select a valid date range.');
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      try {
        const result = await apiClient.listOrderHistory({
          from: range.from,
          to: range.to,
          order_type: orderType,
          limit: PAGE_SIZE,
          offset: fromOffset,
        });
        const next = result.orders ?? [];
        setTotal(result.total ?? next.length);
        setOrders((prev) => (isReset ? next : [...prev, ...next]));
      } catch (err) {
        if (isReset) setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [customFrom, customTo, orderType, period]
  );

  useEffect(() => {
    fetchOrders(0);
  }, [fetchOrders]);

  useEffect(() => {
    if (!hasExtendedHistory && period === 'range') {
      setPeriod('today');
    }
  }, [hasExtendedHistory, period]);

  const periods: { key: HistoryPeriod; label: string }[] = hasExtendedHistory
    ? [...FIXED_PERIODS, { key: 'range', label: 'Date range' }]
    : FIXED_PERIODS;
  const periodLabel = period === 'range'
    ? `${customFrom} to ${customTo}`
    : periods.find((p) => p.key === period)?.label ?? '';

  const handlePrintAll = async () => {
    if (!orders.length || printingAll) return;

    const count = Math.max(total, orders.length);
    const confirmed = window.confirm(
      `Print ${count} receipt${count === 1 ? '' : 's'} for ${periodLabel} (${
        orderType === 'counter' ? 'Counter' : 'Dine-in'
      })?`
    );
    if (!confirmed) return;

    setPrintingAll(true);
    try {
      const range =
        period === 'range'
          ? { from: customFrom, to: customTo }
          : getDateRange(period);

      let all = [...orders];
      let knownTotal = total;
      while (all.length < knownTotal) {
        const result = await apiClient.listOrderHistory({
          from: range.from,
          to: range.to,
          order_type: orderType,
          limit: PAGE_SIZE,
          offset: all.length,
        });
        const next = result.orders ?? [];
        knownTotal = result.total ?? knownTotal;
        if (!next.length) break;
        all = [...all, ...next];
      }

      setTotal(knownTotal);
      setOrders(all);

      if (!all.length) return;

      const paperWidthMm = getPaperWidthMm('bill');
      let anySent = false;
      for (const historyOrder of all) {
        const receiptItems = groupReceiptItems(
          historyOrder.items ?? [],
          profile?.category_display_blocklist ?? [],
        );
        const text = buildReceiptText(historyOrder, profile, receiptItems, paperWidthMm);
        const result = await printBillSmart({
          html: buildReceiptHtml(text, historyOrder, paperWidthMm),
          text,
          orderId: historyOrder.id,
          allowSystemPrint: false,
        });
        if (result !== 'none') anySent = true;
      }
      if (!anySent) {
        printBillHtml(buildCombinedReceiptHtml(all, profile, paperWidthMm));
      }
    } catch (err) {
      console.error('Print all failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to print receipts');
    } finally {
      setPrintingAll(false);
    }
  };

  return (
    <div>
      <PageHeader title="Order History" />

      {/* Subscription banner */}
      {limits.history_days <= 30 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Order history is limited to the last 30 days on your plan. Upgrade for up to 2 years of history.
        </div>
      )}

      {/* Period chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {periods.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              period === key
                ? 'border border-primary bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {hasExtendedHistory && period === 'range' ? (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              From
              <input
                type="date"
                value={customFrom}
                max={customTo || todayIso}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              To
              <input
                type="date"
                value={customTo}
                max={todayIso}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-400">Extended history supports date ranges up to 2 years.</p>
        </div>
      ) : null}

      {/* Order type tabs — always visible so history is never gated */}
      <div className="mb-6 flex gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        {(['dine_in', 'counter'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
              orderType === type
                ? 'border-2 border-primary bg-primary/10 text-primary'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {type === 'dine_in' ? 'Dine-in' : 'Counter'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          <button onClick={() => fetchOrders(0)} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Spinner size="lg" className="text-primary" />
          <p className="text-sm text-gray-500">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No orders found"
          description={`${periodLabel} · ${orderType === 'counter' ? 'Counter' : 'Dine-in'}`}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">{orderType === 'dine_in' ? 'Table' : 'Order'}</th>
                  <th className="px-4 py-3">{orderType === 'dine_in' ? 'Order #' : 'Mode'}</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {orders.length < total && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => fetchOrders(orders.length)}
                disabled={loadingMore || printingAll}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore && <Spinner size="sm" className="text-gray-400" />}
                {loadingMore ? 'Loading…' : `Load more (${total - orders.length} remaining)`}
              </button>
              <p className="text-xs text-gray-400">
                Showing {orders.length} of {total} orders
              </p>
            </div>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
            <button
              type="button"
              onClick={() => void handlePrintAll()}
              disabled={printingAll}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              {printingAll ? <Spinner size="sm" className="text-white" /> : <Printer className="h-4 w-4" />}
              {printingAll ? 'Preparing print…' : `Print all (${Math.max(total, orders.length)})`}
            </button>
          </div>
        </>
      )}

      <ReceiptModal
        order={selectedOrder}
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        restaurant={profile}
      />
    </div>
  );
}
