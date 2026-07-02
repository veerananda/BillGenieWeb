import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Clock, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order, OrderItem } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectActiveOrders,
  setActiveOrders,
  upsertActiveOrder,
} from '../../store/ordersSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Badge } from '../../components/app/Badge';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

type ItemStatus = 'pending' | 'cooking' | 'ready' | 'served';

function getItemStatusVariant(
  status: string
): 'pending' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled' {
  if (status === 'cooking') return 'cooking';
  if (status === 'ready') return 'ready';
  if (status === 'served') return 'served';
  return 'pending';
}

/** Returns border color based on aggregate item statuses */
function getCardBorderClass(order: Order): string {
  const statuses = order.items.map((i) => i.status);
  const allReady = statuses.every((s) => s === 'ready' || s === 'served' || s === 'completed');
  const anyCooking = statuses.some((s) => s === 'cooking');

  if (allReady) return 'border-green-400';
  if (anyCooking) return 'border-amber-400';
  return 'border-gray-200';
}

function hasActiveItems(order: Order): boolean {
  return order.items.some(
    (i) => i.status === 'pending' || i.status === 'cooking' || i.status === 'ready'
  );
}

function isOrderComplete(order: Order): boolean {
  return order.items.every((i) => i.status === 'served' || i.status === 'completed');
}

// ─── Item Status Button ───────────────────────────────────────────────────────

interface ItemActionProps {
  orderId: string;
  item: OrderItem;
  onUpdate: (orderId: string, updatedItem: OrderItem) => void;
}

function ItemActionButton({ orderId, item, onUpdate }: ItemActionProps) {
  const [loading, setLoading] = useState(false);

  const nextStatus: Record<string, ItemStatus | null> = {
    pending: 'cooking',
    cooking: 'ready',
    ready: 'served',
    served: null,
    completed: null,
  };

  const nextLabel: Record<string, string> = {
    pending: 'Start Cooking',
    cooking: 'Mark Ready',
    ready: 'Served',
  };

  const next = nextStatus[item.status] ?? null;
  if (!next) return null;

  async function handleClick() {
    if (!next) return;
    setLoading(true);
    try {
      await apiClient.updateOrderItemStatus(orderId, item.id, next);
      onUpdate(orderId, { ...item, status: next });
    } catch {
      // silently fail — the board will re-sync on next poll
    } finally {
      setLoading(false);
    }
  }

  const colorMap: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    cooking: 'bg-green-100 text-green-700 hover:bg-green-200',
    ready: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${colorMap[item.status] ?? ''}`}
    >
      {loading ? <Spinner size="sm" /> : nextLabel[item.status]}
    </button>
  );
}

// ─── KOT Card ─────────────────────────────────────────────────────────────────

interface KOTCardProps {
  order: Order;
  muted?: boolean;
  onItemUpdate: (orderId: string, updatedItem: OrderItem) => void;
}

function KOTCard({ order, muted, onItemUpdate }: KOTCardProps) {
  const elapsed = getElapsedMinutes(order.created_at);
  const borderClass = muted ? 'border-gray-100' : getCardBorderClass(order);
  const isUrgent = elapsed >= 15 && !muted;

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 bg-white shadow-sm transition-all ${borderClass} ${muted ? 'opacity-50' : ''}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <p className="font-bold text-gray-900">Order #{order.order_number}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {order.order_type === 'counter' ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Counter
              </span>
            ) : (
              <span>Table {order.table_number}</span>
            )}
          </p>
        </div>
        <div
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isUrgent ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 divide-y divide-gray-50 px-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-700">
                ×{item.quantity}
              </span>
              <span className="truncate text-sm font-medium text-gray-800">
                {item.menu_item?.name ?? `Item ${item.menu_id.slice(0, 6)}`}
              </span>
              {item.notes && (
                <span className="shrink-0 text-xs text-amber-600 italic">({item.notes})</span>
              )}
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              <Badge variant={getItemStatusVariant(item.status)}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Badge>
              {!muted && (
                <ItemActionButton
                  orderId={order.id}
                  item={item}
                  onUpdate={onItemUpdate}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Kitchen() {
  const dispatch = useAppDispatch();
  const activeOrders = useAppSelector(selectActiveOrders);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.listOrdersSummary('active');
      dispatch(setActiveOrders(result.orders));
      setLastRefreshed(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 60_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  function handleItemUpdate(orderId: string, updatedItem: OrderItem) {
    const order = activeOrders.find((o) => o.id === orderId);
    if (!order) return;
    const updatedOrder: Order = {
      ...order,
      items: order.items.map((i) => (i.id === updatedItem.id ? updatedItem : i)),
    };
    dispatch(upsertActiveOrder(updatedOrder));
  }

  // Filter to orders with kitchen-relevant items
  const kitchenOrders = activeOrders.filter((o) =>
    o.items.some(
      (i) => i.status === 'pending' || i.status === 'cooking' || i.status === 'ready'
    )
  );

  // Sort oldest first (most urgent)
  const sorted = [...kitchenOrders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const activeCards = sorted.filter(hasActiveItems);
  const completedCards = sorted.filter(isOrderComplete);

  return (
    <div className="flex-1 p-6">
      <PageHeader
        title="Kitchen"
        subtitle="Live order board"
        action={
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {lastRefreshed && (
        <p className="mb-4 text-xs text-gray-400">
          Last updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          {' · '}Auto-refreshes every 60 s
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          <button onClick={fetchOrders} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {loading && activeOrders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : activeCards.length === 0 && completedCards.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No active orders — all caught up!"
          description="New orders will appear here automatically."
        />
      ) : (
        <div className="space-y-8">
          {activeCards.length > 0 && (
            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {activeCards.map((order) => (
                  <KOTCard
                    key={order.id}
                    order={order}
                    onItemUpdate={handleItemUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {completedCards.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                All Served
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {completedCards.map((order) => (
                  <KOTCard
                    key={order.id}
                    order={order}
                    muted
                    onItemUpdate={handleItemUpdate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
