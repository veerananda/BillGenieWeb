import { useCallback, useEffect, useState } from 'react';
import { History as HistoryIcon } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits } from '../../lib/subscriptionLimits';
import { PageHeader } from '../../components/app/PageHeader';
import { Modal } from '../../components/app/Modal';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Types & constants ────────────────────────────────────────────────────────

type HistoryPeriod = 'today' | 'yesterday' | 'week' | 'month';
type OrderTypeTab = 'dine_in' | 'counter';

const PAGE_SIZE = 50;

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDateRange(period: HistoryPeriod): { from: string; to: string } {
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

function isCounter(order: Order): boolean {
  return order.order_type === 'counter';
}

function getCounterLabel(order: Order): string {
  return String(order.ticket_number ?? order.order_number ?? '?');
}

function getOrderTitle(order: Order): string {
  if (isCounter(order)) {
    const mode = order.service_mode === 'takeaway' ? 'Takeaway' : 'Counter';
    return `${mode} #${getCounterLabel(order)}`;
  }
  return `Table ${order.table_number}`;
}

function formatOrderTime(order: Order): string {
  const raw = order.completed_at || order.updated_at || order.created_at;
  if (!raw) return '';
  return new Date(raw).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Receipt modal ────────────────────────────────────────────────────────────

function ReceiptModal({ order, open, onClose }: { order: Order | null; open: boolean; onClose: () => void }) {
  if (!order) return null;

  const counter = isCounter(order);
  const title = getOrderTitle(order);
  const completedAt = order.completed_at || order.updated_at || order.created_at;
  const payment = (order.payment_method || '').toUpperCase();

  // On counter orders, skip generic placeholder names
  const showCustomer = counter
    ? !!order.customer_name && !['Takeaway', 'Counter', 'Self Service'].includes(order.customer_name)
    : !!order.customer_name;

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <div className="space-y-5">
        {/* Receipt label */}
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Receipt</p>

        {/* Order identity */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">Order #{order.order_number}</p>
          {completedAt && <p className="text-sm text-gray-500">{formatDateTime(completedAt)}</p>}
          {showCustomer && <p className="text-sm text-gray-500">Customer: {order.customer_name}</p>}
          {order.customer_phone && <p className="text-sm text-gray-500">Phone: {order.customer_phone}</p>}
        </div>

        <div className="border-t border-gray-100" />

        {/* Line items */}
        <div className="space-y-4">
          {(order.items ?? []).map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">
                  {item.menu_item?.name ?? 'Item'}
                  {item.notes && (
                    <span className="ml-1 text-xs font-normal italic text-amber-600">({item.notes})</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {item.quantity} × {fmt(item.unit_rate)}
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
          {payment && (
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span className="font-semibold text-gray-700">{payment}</span>
            </div>
          )}
          {payment === 'CASH' && Number(order.amount_received) > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-500">Received</span>
                <span className="text-gray-700">{fmt(order.amount_received)}</span>
              </div>
              {Number(order.change_returned) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Change</span>
                  <span className="text-gray-700">{fmt(order.change_returned)}</span>
                </div>
              )}
            </>
          )}
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
      </div>
    </Modal>
  );
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const itemCount = order.items?.length ?? 0;
  const payment = (order.payment_method || '').toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold text-gray-900">{getOrderTitle(order)}</span>
        <span className="shrink-0 text-base font-bold text-primary">{fmt(order.total)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-500">
        <span>#{order.order_number}</span>
        <span className="text-gray-300">·</span>
        <span>{formatOrderTime(order)}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </span>
        {payment && (
          <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
            {payment}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function History() {
  const profile = useAppSelector(selectProfile);
  const limits = parseSubscriptionLimits(
    (profile?.subscription_config as Record<string, unknown>) ?? null
  );

  const [period, setPeriod] = useState<HistoryPeriod>('today');
  const [orderType, setOrderType] = useState<OrderTypeTab>('dine_in');

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(
    async (fromOffset: number) => {
      const { from, to } = getDateRange(period);
      const isReset = fromOffset === 0;
      if (isReset) { setLoading(true); setError(null); setOrders([]); setTotal(0); }
      else setLoadingMore(true);

      try {
        const result = await apiClient.listOrderHistory({
          from,
          to,
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
    [period, orderType]
  );

  useEffect(() => {
    fetchOrders(0);
  }, [fetchOrders]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';

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
        {PERIODS.map(({ key, label }) => (
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
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} onClick={() => setSelectedOrder(order)} />
            ))}
          </div>

          {/* Load more */}
          {orders.length < total && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                onClick={() => fetchOrders(orders.length)}
                disabled={loadingMore}
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
        </>
      )}

      <ReceiptModal
        order={selectedOrder}
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
