import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, Check, Wifi } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setActiveOrders, setCounterOrders, patchOrderItemStatus,
  selectActiveOrders, selectCounterOrders,
} from '../../store/ordersSlice';
import { selectMenuItems, selectMenuHydrated, setMenuItems } from '../../store/menuSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';
import wsService from '../../services/websocket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KotItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  notes?: string;
  status: string;
  menuId: string;
}

interface KotTicket {
  key: string;
  kotNumber: number;
  orderId: string;
  tableLabel: string;
  customerName: string;
  serviceMode?: string;
  firedAt: Date;
  items: KotItem[];
}

interface MenuEntry {
  name: string;
  readily_available?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(status: string) {
  return status !== 'ready' && status !== 'served' && status !== 'completed';
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  return `${mins} mins ago`;
}

function resolveTableLabel(order: Order): string {
  if (order.order_type === 'counter') {
    const num = order.ticket_number ?? order.order_number;
    const suffix =
      order.service_mode === 'takeaway'
        ? ' · Takeaway'
        : order.service_mode === 'eat_here'
        ? ' · Eat here'
        : '';
    return `Order #${num}${suffix}`;
  }
  return `Table ${order.table_number ?? '?'}`;
}

function buildTickets(
  orders: Order[],
  menuMap: Record<string, MenuEntry>
): KotTicket[] {
  const tickets: KotTicket[] = [];

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const activeItems = (order.items ?? []).filter(
      (i) => isActive(i.status) && !menuMap[i.menu_id]?.readily_available
    );
    if (activeItems.length === 0) continue;

    tickets.push({
      key: order.id,
      kotNumber: 0,
      orderId: order.id,
      tableLabel: resolveTableLabel(order),
      customerName: order.customer_name || 'Guest',
      serviceMode: order.service_mode,
      firedAt: new Date(order.created_at),
      items: activeItems.map((item) => ({
        id: item.id,
        orderId: order.id,
        name: menuMap[item.menu_id]?.name ?? item.menu_item?.name ?? item.menu_id,
        quantity: item.quantity,
        notes: item.notes,
        status: item.status,
        menuId: item.menu_id,
      })),
    });
  }

  tickets.sort((a, b) => a.firedAt.getTime() - b.firedAt.getTime());
  tickets.forEach((t, i) => { t.kotNumber = i + 1; });

  return tickets;
}

function buildPrepSummary(tickets: KotTicket[]) {
  const map = new Map<string, { name: string; qty: number }>();
  for (const t of tickets) {
    for (const item of t.items) {
      const key = item.menuId || item.name;
      const ex = map.get(key);
      if (ex) ex.qty += item.quantity;
      else map.set(key, { name: item.name, qty: item.quantity });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── KOT Card ─────────────────────────────────────────────────────────────────

function KOTCard({
  ticket,
  onItemReady,
}: {
  ticket: KotTicket;
  onItemReady: (orderId: string, itemId: string) => void;
}) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [readyAllLoading, setReadyAllLoading] = useState(false);

  async function handleItemReady(item: KotItem) {
    if (markingId || readyAllLoading) return;
    setMarkingId(item.id);
    try {
      onItemReady(item.orderId, item.id); // optimistic (sync)
      await apiClient.updateOrderItemStatus(item.orderId, item.id, 'ready');
    } catch {
      // WS will eventually sync the correct state
    } finally {
      setMarkingId(null);
    }
  }

  async function handleReadyAll() {
    setReadyAllLoading(true);
    // Optimistic: mark all items ready immediately (sync)
    ticket.items.forEach((item) => onItemReady(item.orderId, item.id));
    try {
      await Promise.all(
        ticket.items.map((item) =>
          apiClient.updateOrderItemStatus(item.orderId, item.id, 'ready')
        )
      );
    } catch {
      // silent
    } finally {
      setReadyAllLoading(false);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: '#1BAE76' }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
              KOT #{ticket.kotNumber}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-900">{ticket.tableLabel}</p>
          <p className="mt-0.5 text-sm text-gray-500">{ticket.customerName}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatElapsed(ticket.firedAt)} · Fired {formatTime(ticket.firedAt)}
          </p>
        </div>
        <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
          <span className="text-sm font-semibold text-gray-700">
            {formatTime(ticket.firedAt)}
          </span>
          <button
            onClick={handleReadyAll}
            disabled={readyAllLoading}
            className="flex min-w-18 items-center justify-center rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {readyAllLoading ? <Spinner size="sm" className="text-white" /> : 'Ready all'}
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1.5 p-3">
        {ticket.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
              {item.notes && (
                <p className="mt-0.5 text-xs italic text-gray-400">{item.notes}</p>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold text-primary">{item.quantity}x</span>
            <button
              onClick={() => handleItemReady(item)}
              disabled={markingId === item.id || readyAllLoading}
              className="flex min-w-12 flex-col items-center rounded-lg bg-green-500 px-2.5 py-1.5 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {markingId === item.id ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="mt-0.5 text-[9px] font-bold">Ready</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Kitchen() {
  const dispatch = useAppDispatch();

  // Read from Redux — AppShell's WS handlers keep these slices live
  const activeOrders = useAppSelector(selectActiveOrders);
  const counterOrders = useAppSelector(selectCounterOrders);
  const allOrders = useMemo(
    () => [...activeOrders, ...counterOrders],
    [activeOrders, counterOrders]
  );

  const menuItems = useAppSelector(selectMenuItems);
  const menuHydrated = useAppSelector(selectMenuHydrated);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(() => wsService.isConnected());

  // Tick every minute to keep elapsed-time labels fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Track WS connection status for the indicator
  useEffect(() => {
    setConnected(wsService.isConnected());
    const unsub1 = wsService.on('connected', () => setConnected(true));
    const unsub2 = wsService.on('disconnected', () => setConnected(false));
    return () => { unsub1(); unsub2(); };
  }, []);

  const menuMap = useMemo(
    () =>
      Object.fromEntries(
        menuItems.map((m) => [m.id, { name: m.name, readily_available: m.readily_available }])
      ) as Record<string, MenuEntry>,
    [menuItems]
  );

  // ── Optimistic mark-ready — dispatches to Redux (AppShell's WS handler can't revert it due to max-status guard)
  const onItemReady = useCallback(
    (orderId: string, itemId: string) => {
      dispatch(patchOrderItemStatus({ orderId, itemId, status: 'ready' }));
    },
    [dispatch]
  );

  // ── Initial data fetch — populates both Redux slices ──────────────────────

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dineInRes, counterRes] = await Promise.all([
        apiClient.listOrders('active', 100),
        apiClient.listCounterOrdersToday().catch(() => ({ orders: [] as Order[], total: 0 })),
        !menuHydrated
          ? apiClient.listMenuItems().then((items) => dispatch(setMenuItems(items)))
          : Promise.resolve(),
      ]);

      dispatch(setActiveOrders(dineInRes.orders));

      const dineInIds = new Set(dineInRes.orders.map((o) => o.id));
      const todayCounterOrders = (counterRes.orders ?? []).filter(
        (o) => o.status !== 'cancelled' && !dineInIds.has(o.id)
      );
      dispatch(setCounterOrders(todayCounterOrders));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [dispatch, menuHydrated]);

  // Mount: fetch once — WS (via AppShell) keeps Redux live after that
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const tickets = useMemo(() => buildTickets(allOrders, menuMap), [allOrders, menuMap]);
  const prepSummary = useMemo(() => buildPrepSummary(tickets), [tickets]);

  const statsKOTs = tickets.length;
  const statsLines = tickets.reduce((s, t) => s + t.items.length, 0);
  const statsPortions = tickets.reduce(
    (s, t) => s + t.items.reduce((si, i) => si + i.quantity, 0),
    0
  );

  return (
    <div>
      <PageHeader
        title="Kitchen Updates"
        action={
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Wifi className={`h-3.5 w-3.5 ${connected ? 'text-green-500' : 'text-red-400'}`} />
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          <button onClick={fetchOrders} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="mb-5 grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex flex-col items-center py-4">
          <span className="text-2xl font-bold text-primary">{statsKOTs}</span>
          <span className="mt-0.5 text-xs text-gray-500">KOTs in queue</span>
        </div>
        <div className="flex flex-col items-center py-4">
          <span className="text-2xl font-bold text-amber-500">{statsLines}</span>
          <span className="mt-0.5 text-xs text-gray-500">Lines to prepare</span>
        </div>
        <div className="flex flex-col items-center py-4">
          <span className="text-2xl font-bold text-green-600">{statsPortions}</span>
          <span className="mt-0.5 text-xs text-gray-500">Total portions</span>
        </div>
      </div>

      {/* Batch prep — cook by dish */}
      {prepSummary.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            Batch prep — cook by dish
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {prepSummary.map((entry) => (
              <div
                key={entry.name}
                className="flex shrink-0 flex-col rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm min-w-24"
              >
                <p className="text-xs font-semibold leading-tight text-gray-800 line-clamp-2">
                  {entry.name}
                </p>
                <span className="mt-1 text-lg font-extrabold text-primary">×{entry.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && allOrders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No KOTs in kitchen"
          description="Each order from dine-in or counter creates a numbered ticket in FIFO order"
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-3">
          {tickets.map((ticket) => (
            <KOTCard key={ticket.key} ticket={ticket} onItemReady={onItemReady} />
          ))}
        </div>
      )}
    </div>
  );
}
