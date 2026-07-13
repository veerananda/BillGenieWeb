import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, Check, Wifi } from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setActiveOrders,
  patchOrderItemStatus,
  selectActiveOrders,
  selectCounterOrders,
  setCounterOrders,
} from '../../store/ordersSlice';
import { selectMenuItems, selectMenuHydrated, setMenuItems } from '../../store/menuSlice';
import { selectTables, setTables, selectTablesHydrated } from '../../store/tablesSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';
import wsService from '../../services/websocket';
import {
  buildKotTickets,
  buildPrepSummary,
  formatKitchenElapsed,
  formatKitchenTime,
  getKotTableLabel,
  type KotTicket,
  type KotTicketItem,
} from '../../lib/kitchenHelpers';

function KOTCard({
  ticket,
  onItemReady,
}: {
  ticket: KotTicket;
  onItemReady: (orderId: string, itemId: string) => void;
}) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [readyAllLoading, setReadyAllLoading] = useState(false);
  const tableLabel = getKotTableLabel(ticket);

  async function handleItemReady(item: KotTicketItem) {
    if (markingId || readyAllLoading) return;
    setMarkingId(item.id);
    try {
      onItemReady(item.orderId, item.id);
      await apiClient.updateOrderItemStatus(item.orderId, item.id, 'ready');
    } catch {
      // WS will eventually sync the correct state
    } finally {
      setMarkingId(null);
    }
  }

  async function handleReadyAll() {
    setReadyAllLoading(true);
    ticket.items.forEach((item) => onItemReady(item.orderId, item.id));
    try {
      await Promise.all(
        ticket.items.map((item) =>
          apiClient.updateOrderItemStatus(item.orderId, item.id, 'ready')
        )
      );
    } catch {
      // silent — WS catch-up handles partial failures
    } finally {
      setReadyAllLoading(false);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-xl bg-white shadow-sm"
      style={{
        borderWidth: 1,
        borderColor: ticket.isAddOn ? '#f59e0b' : '#e5e7eb',
        borderLeftWidth: 4,
        borderLeftColor: ticket.isAddOn ? '#f59e0b' : '#1BAE76',
      }}
    >
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-white">
              KOT #{ticket.kotNumber}
            </span>
            {ticket.isAddOn ? (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                ADD-ON
              </span>
            ) : null}
          </div>
          <p className="text-lg font-bold text-gray-900">{tableLabel}</p>
          <p className="mt-0.5 text-sm text-gray-500">{ticket.customerName}</p>
          <p className="mt-1 text-xs text-gray-400">
            {formatKitchenElapsed(ticket.firedAt)} · Fired {formatKitchenTime(ticket.firedAt)}
          </p>
        </div>
        <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
          <span className="text-sm font-semibold text-gray-700">
            {formatKitchenTime(ticket.firedAt)}
          </span>
          <button
            onClick={handleReadyAll}
            disabled={readyAllLoading}
            className="flex min-w-18 items-center justify-center rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
          >
            {readyAllLoading ? <Spinner size="sm" className="text-white" /> : 'Ready all'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-3">
        {ticket.items.map((item) => (
          <div
            key={`${item.orderId}-${item.id}`}
            className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{item.name}</p>
              {item.notes ? (
                <p className="mt-0.5 text-xs italic text-gray-400">{item.notes}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-bold text-primary">{item.quantity}x</span>
            <button
              onClick={() => handleItemReady(item)}
              disabled={markingId === item.id || readyAllLoading}
              className="flex min-w-12 flex-col items-center rounded-lg bg-green-500 px-2.5 py-1.5 text-white transition-colors hover:bg-green-600 disabled:opacity-50"
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

function isTodayOrder(order: { created_at?: string }): boolean {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const ts = order.created_at ? new Date(order.created_at).getTime() : 0;
  return ts >= midnight.getTime();
}

function kitchenSourceOrders(
  activeOrders: ReturnType<typeof selectActiveOrders>,
  counterOrders: ReturnType<typeof selectCounterOrders>
) {
  const todayActive = activeOrders.filter(isTodayOrder);
  const liveCounter = counterOrders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled' && isTodayOrder(o)
  );
  const activeIds = new Set(todayActive.map((o) => o.id));
  const counterOnly = liveCounter.filter((o) => !activeIds.has(o.id));
  return [...todayActive, ...counterOnly];
}

export function Kitchen() {
  const dispatch = useAppDispatch();
  const activeOrders = useAppSelector(selectActiveOrders);
  const counterOrders = useAppSelector(selectCounterOrders);
  const tables = useAppSelector(selectTables);
  const menuItems = useAppSelector(selectMenuItems);
  const menuHydrated = useAppSelector(selectMenuHydrated);
  const tablesHydrated = useAppSelector(selectTablesHydrated);

  const sourceOrders = useMemo(
    () => kitchenSourceOrders(activeOrders, counterOrders),
    [activeOrders, counterOrders]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(() => wsService.isConnected());

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setConnected(wsService.isConnected());
    const unsub1 = wsService.on('connected', () => setConnected(true));
    const unsub2 = wsService.on('disconnected', () => setConnected(false));
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const onItemReady = useCallback(
    (orderId: string, itemId: string) => {
      dispatch(patchOrderItemStatus({ orderId, itemId, status: 'ready' }));
    },
    [dispatch]
  );

  const fetchKitchenOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use full-order endpoints so items[] are present for buildKotTickets.
      // listOrdersSummary omits items[] and produces empty KOT tickets.
      const tasks: Promise<unknown>[] = [
        apiClient.listOrders('active').then((res) => {
          dispatch(setActiveOrders(res.orders));
        }),
        apiClient.listCounterOrdersToday().then((res) => {
          const active = (res.orders ?? []).filter(
            (o) => o.status !== 'completed' && o.status !== 'cancelled'
          );
          dispatch(setCounterOrders(active));
        }),
      ];
      if (!menuHydrated) {
        tasks.push(apiClient.listMenuItems().then((items) => dispatch(setMenuItems(items))));
      }
      if (!tablesHydrated) {
        tasks.push(apiClient.getTables().then((t) => dispatch(setTables(t))));
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [dispatch, menuHydrated, tablesHydrated]);

  useEffect(() => {
    void fetchKitchenOrders();
  }, [fetchKitchenOrders]);

  const tickets = useMemo(
    () => buildKotTickets(sourceOrders, tables, menuItems),
    [sourceOrders, tables, menuItems]
  );
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

      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          <button onClick={() => void fetchKitchenOrders()} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

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

      {prepSummary.length > 0 ? (
        <div className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            Batch prep — cook by dish
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {prepSummary.map((entry) => (
              <div
                key={entry.menuId}
                className="flex min-w-24 shrink-0 flex-col rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm"
              >
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-800">
                  {entry.name}
                </p>
                <span className="mt-1 text-lg font-extrabold text-primary">×{entry.totalQty}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="No KOTs in kitchen"
          description="Each save from dine-in or counter creates a numbered ticket in FIFO order"
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
