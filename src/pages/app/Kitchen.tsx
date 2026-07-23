import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChefHat, Check, X, Wifi } from 'lucide-react';
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
import { Modal } from '../../components/app/Modal';
import wsService from '../../services/websocket';
import {
  buildKotTickets,
  buildKitchenSourceOrders,
  buildPrepSummary,
  formatKitchenElapsed,
  formatKitchenTime,
  getKotTableLabel,
  isActiveKitchenItem,
  type KotTicket,
  type KotTicketItem,
} from '../../lib/kitchenHelpers';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits } from '../../lib/subscriptionLimits';

type KitchenConfirmAction =
  | { type: 'ready'; item: KotTicketItem }
  | { type: 'cancel'; item: KotTicketItem }
  | { type: 'ready_all' };

function KOTCard({
  ticket,
  onItemReady,
  onItemCancel,
}: {
  ticket: KotTicket;
  onItemReady: (orderId: string, itemId: string) => void;
  onItemCancel: (orderId: string, itemId: string) => void;
}) {
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [readyAllLoading, setReadyAllLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<KitchenConfirmAction | null>(null);
  const tableLabel = getKotTableLabel(ticket);
  const busy = Boolean(markingId || cancellingId || readyAllLoading);

  function requestItemReady(item: KotTicketItem) {
    if (busy) return;
    setConfirmAction({ type: 'ready', item });
  }

  function requestItemCancel(item: KotTicketItem) {
    if (ticket.isSelfService || busy) return;
    setConfirmAction({ type: 'cancel', item });
  }

  function requestReadyAll() {
    if (busy) return;
    const activeCount = ticket.items.filter((item) => isActiveKitchenItem(item.status)).length;
    if (activeCount === 0) return;
    setConfirmAction({ type: 'ready_all' });
  }

  async function handleConfirm() {
    if (!confirmAction || busy) return;
    const action = confirmAction;

    if (action.type === 'ready') {
      setMarkingId(action.item.id);
      try {
        onItemReady(action.item.orderId, action.item.id);
        await apiClient.updateOrderItemStatus(action.item.orderId, action.item.id, 'ready');
      } catch {
        // WS will eventually sync the correct state
      } finally {
        setMarkingId(null);
        setConfirmAction(null);
      }
      return;
    }

    if (action.type === 'cancel') {
      setCancellingId(action.item.id);
      try {
        onItemCancel(action.item.orderId, action.item.id);
        await apiClient.updateOrderItemStatus(action.item.orderId, action.item.id, 'cancelled');
      } catch {
        // WS will eventually sync the correct state
      } finally {
        setCancellingId(null);
        setConfirmAction(null);
      }
      return;
    }

    setReadyAllLoading(true);
    const active = ticket.items.filter((item) => isActiveKitchenItem(item.status));
    active.forEach((item) => onItemReady(item.orderId, item.id));
    try {
      await Promise.all(
        active.map((item) => apiClient.updateOrderItemStatus(item.orderId, item.id, 'ready'))
      );
    } catch {
      // silent — WS catch-up handles partial failures
    } finally {
      setReadyAllLoading(false);
      setConfirmAction(null);
    }
  }

  const confirmTitle =
    confirmAction?.type === 'cancel'
      ? 'Cancel item?'
      : confirmAction?.type === 'ready_all'
        ? 'Mark all ready?'
        : 'Mark ready?';

  const confirmMessage =
    confirmAction?.type === 'cancel'
      ? `Cancel "${confirmAction.item.name}" from this KOT? It will be removed from the table order.`
      : confirmAction?.type === 'ready_all'
        ? `Mark all ${ticket.items.filter((item) => isActiveKitchenItem(item.status)).length} item(s) on KOT #${ticket.kotNumber} (${tableLabel}) as ready?`
        : confirmAction
          ? `Mark "${confirmAction.item.name}" as ready?`
          : '';

  const confirmButtonLabel =
    confirmAction?.type === 'cancel'
      ? 'Cancel item'
      : confirmAction?.type === 'ready_all'
        ? 'Ready all'
        : 'Mark ready';

  const confirmButtonClass =
    confirmAction?.type === 'cancel'
      ? 'bg-red-600 hover:opacity-90'
      : 'bg-green-600 hover:opacity-90';

  return (
    <>
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
            <p className="mt-1 text-xs text-gray-400">
              {formatKitchenElapsed(ticket.firedAt)} · Fired {formatKitchenTime(ticket.firedAt)}
            </p>
          </div>
          <div className="ml-3 flex shrink-0 flex-col items-end">
            <button
              onClick={requestReadyAll}
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
                <p className="whitespace-normal break-words text-sm font-semibold leading-snug text-gray-800">
                  {item.name}
                </p>
                {item.category ? (
                  <p className="mt-0.5 text-xs text-gray-400">{item.category}</p>
                ) : null}
                {item.notes ? (
                  <p className="mt-0.5 text-xs italic text-amber-600">{item.notes}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-bold text-primary">{item.quantity}x</span>
              <div className="flex shrink-0 items-center gap-1.5">
                {!ticket.isSelfService ? (
                  <button
                    onClick={() => requestItemCancel(item)}
                    disabled={markingId === item.id || cancellingId === item.id || readyAllLoading}
                    className="flex min-w-12 flex-col items-center rounded-lg bg-red-500 px-2.5 py-1.5 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {cancellingId === item.id ? (
                      <Spinner size="sm" className="text-white" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span className="mt-0.5 text-[9px] font-bold">Cancel</span>
                  </button>
                ) : null}
                <button
                  onClick={() => requestItemReady(item)}
                  disabled={markingId === item.id || cancellingId === item.id || readyAllLoading}
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
            </div>
          ))}
        </div>
      </div>

      <Modal
        open={!!confirmAction}
        onClose={() => !busy && setConfirmAction(null)}
        title={confirmTitle}
        maxWidth="sm"
      >
        <p className="mb-6 text-sm text-gray-600">{confirmMessage}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmAction(null)}
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={busy}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60 ${confirmButtonClass}`}
          >
            {busy ? <Spinner size="sm" className="text-white" /> : null}
            {confirmButtonLabel}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function Kitchen() {
  const dispatch = useAppDispatch();
  const activeOrders = useAppSelector(selectActiveOrders);
  const counterOrders = useAppSelector(selectCounterOrders);
  const tables = useAppSelector(selectTables);
  const menuItems = useAppSelector(selectMenuItems);
  const menuHydrated = useAppSelector(selectMenuHydrated);
  const tablesHydrated = useAppSelector(selectTablesHydrated);
  const profile = useAppSelector(selectProfile);
  const limits = useMemo(
    () =>
      parseSubscriptionLimits(
        (profile?.subscription_limits as unknown as Record<string, unknown>) ?? null
      ),
    [profile?.subscription_limits]
  );

  const sourceOrders = useMemo(
    () => buildKitchenSourceOrders(activeOrders, counterOrders, limits),
    [activeOrders, counterOrders, limits]
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

  const onItemCancel = useCallback(
    (orderId: string, itemId: string) => {
      dispatch(patchOrderItemStatus({ orderId, itemId, status: 'cancelled' }));
    },
    [dispatch]
  );

  const fetchKitchenOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [];

      if (limits.kitchen_dine_in) {
        tasks.push(
          apiClient.listOrders('active').then((res) => {
            dispatch(setActiveOrders(res.orders));
          })
        );
      }

      if (limits.kitchen_counter) {
        tasks.push(
          apiClient.listCounterOrdersToday().then((res) => {
            const active = (res.orders ?? []).filter(
              (o) => o.status !== 'completed' && o.status !== 'cancelled'
            );
            dispatch(setCounterOrders(active));
          })
        );
      }

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
  }, [dispatch, limits.kitchen_counter, limits.kitchen_dine_in, menuHydrated, tablesHydrated]);

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
                <p className="whitespace-normal break-words text-xs font-semibold leading-snug text-gray-800">
                  {entry.name}
                </p>
                {entry.category ? (
                  <p className="mt-0.5 text-[11px] text-gray-400">{entry.category}</p>
                ) : null}
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
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tickets.map((ticket) => (
            <KOTCard
              key={ticket.key}
              ticket={ticket}
              onItemReady={onItemReady}
              onItemCancel={onItemCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
