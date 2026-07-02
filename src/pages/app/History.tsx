import { useState, useEffect, useCallback } from 'react';
import { History as HistoryIcon, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Badge } from '../../components/app/Badge';
import { Modal } from '../../components/app/Modal';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isoDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return isoDateString(d);
}

function defaultTo(): string {
  return isoDateString(new Date());
}

function getStatusVariant(
  status: string
): 'pending' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'cooking') return 'cooking';
  if (status === 'ready') return 'ready';
  if (status === 'served') return 'served';
  return 'pending';
}

type OrderType = 'all' | 'dine_in' | 'counter';

// ─── Order Detail Modal ───────────────────────────────────────────────────────

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
}

function OrderDetailModal({ order, open, onClose }: OrderDetailModalProps) {
  if (!order) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Order #${order.order_number}`} maxWidth="lg">
      <div className="space-y-5">
        {/* Meta info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Status</p>
            <div className="mt-1">
              <Badge variant={getStatusVariant(order.status)}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Type</p>
            <p className="mt-1 font-medium text-gray-900">
              {order.order_type === 'counter' ? 'Counter' : 'Dine-in'}
              {order.service_mode && (
                <span className="ml-1 text-gray-400">
                  ({order.service_mode === 'takeaway' ? 'Takeaway' : 'Eat Here'})
                </span>
              )}
            </p>
          </div>
          {order.customer_name && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Customer</p>
              <p className="mt-1 font-medium text-gray-900">{order.customer_name}</p>
              {order.customer_phone && (
                <p className="text-xs text-gray-400">{order.customer_phone}</p>
              )}
            </div>
          )}
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Placed At</p>
            <p className="mt-1 font-medium text-gray-900">{formatDate(order.created_at)}</p>
          </div>
          {order.completed_at && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Completed At</p>
              <p className="mt-1 font-medium text-gray-900">{formatDate(order.completed_at)}</p>
            </div>
          )}
          {order.payment_method && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Payment</p>
              <p className="mt-1 font-medium capitalize text-gray-900">{order.payment_method}</p>
              {order.amount_received != null && (
                <p className="text-xs text-gray-400">
                  Received: {formatCurrency(order.amount_received)}
                  {order.change_returned != null && order.change_returned > 0 && (
                    <> · Change: {formatCurrency(order.change_returned)}</>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">
            Items ({order.items.length})
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Item</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Rate</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 text-gray-800">
                      {item.menu_item?.name ?? `Item (${item.menu_id.slice(0, 6)})`}
                      {item.notes && (
                        <span className="ml-1 text-xs italic text-amber-600">({item.notes})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {formatCurrency(item.unit_rate)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(order.sub_total)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Tax</span>
            <span>{formatCurrency(order.tax_amount)}</span>
          </div>
          {order.discount_amount != null && order.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−{formatCurrency(order.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1.5 font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function History() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [page, setPage] = useState(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Pending filter values (uncommitted until Search is clicked)
  const [pendingFrom, setPendingFrom] = useState(defaultFrom);
  const [pendingTo, setPendingTo] = useState(defaultTo);
  const [pendingType, setPendingType] = useState<OrderType>('all');

  const fetchHistory = useCallback(
    async (f: string, t: string, type: OrderType, offset: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient.listOrderHistory({
          from: f,
          to: t,
          order_type: type === 'all' ? undefined : type,
          limit: PAGE_SIZE,
          offset,
        });
        setOrders(result.orders);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order history');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchHistory(from, to, orderType, page * PAGE_SIZE);
  }, [fetchHistory, from, to, orderType, page]);

  function handleSearch() {
    setFrom(pendingFrom);
    setTo(pendingTo);
    setOrderType(pendingType);
    setPage(0);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="flex-1 p-6">
      <PageHeader title="Order History" />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={pendingFrom}
            onChange={(e) => setPendingFrom(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={pendingTo}
            onChange={(e) => setPendingTo(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Order Type</label>
          <select
            value={pendingType}
            onChange={(e) => setPendingType(e.target.value as OrderType)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All</option>
            <option value="dine_in">Dine-in</option>
            <option value="counter">Counter</option>
          </select>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          <button
            onClick={() => fetchHistory(from, to, orderType, page * PAGE_SIZE)}
            className="font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="No orders found"
          description="Try adjusting the date range or order type filter."
        />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Order #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600">{formatDateShort(order.created_at)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.order_type === 'counter' ? 'Counter' : 'Dine-in'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {order.customer_name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">{order.items.length}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{showingFrom}–{showingTo}</span> of{' '}
              <span className="font-medium">{total}</span> orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="min-w-[2rem] text-center text-sm font-medium text-gray-700">
                {page + 1} / {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <OrderDetailModal
        order={selectedOrder}
        open={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
