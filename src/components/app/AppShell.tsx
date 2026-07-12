import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SubscriptionBanner } from './SubscriptionBanner';
import { Sidebar } from './Sidebar';
import { useAppDispatch } from '../../store/hooks';
import { setProfile } from '../../store/profileSlice';
import apiClient from '../../services/api';
import wsService from '../../services/websocket';
import { store } from '../../store';
import {
  upsertActiveOrder, removeActiveOrder,
  upsertCounterOrder, removeCounterOrder,
  patchOrderItemStatus,
  setActiveOrders, setCounterOrders,
} from '../../store/ordersSlice';
import { setTables } from '../../store/tablesSlice';
import { setTableOccupied, upsertTable } from '../../store/tablesSlice';
import { upsertInventoryIngredient } from '../../store/inventorySlice';
import { addMenuItem, updateMenuItem, removeMenuItem } from '../../store/menuSlice';
import type { Order, RestaurantTable, MenuItem } from '../../services/api';
import type { InventoryIngredient } from '../../store/inventorySlice';
import type { AppDispatch } from '../../store';

function isCounterOrder(data: Record<string, unknown>): boolean {
  return data.order_type === 'counter' || data.orderType === 'counter';
}

function hydrateOrder(orderId: string, counter: boolean, dispatch: AppDispatch) {
  apiClient.getOrder(orderId)
    .then((order) => {
      if (counter || isCounterOrder(order as unknown as Record<string, unknown>)) {
        dispatch(upsertCounterOrder(order));
      } else {
        dispatch(upsertActiveOrder(order));
      }
    })
    .catch(() => {});
}

function upsertOrderFromWsEvent(data: Record<string, unknown>, dispatch: AppDispatch) {
  const orderId = (data.order_id ?? data.id) as string | undefined;
  if (!orderId) return;
  const counter = isCounterOrder(data);
  const items = (data as { items?: unknown[] }).items;
  if (items?.length) {
    const order = { ...data, id: orderId } as unknown as Order;
    if (counter) {
      dispatch(upsertCounterOrder(order));
    } else {
      dispatch(upsertActiveOrder(order));
    }
    return;
  }
  hydrateOrder(orderId, counter, dispatch);
}

export function AppShell() {
  const dispatch = useAppDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function runCatchUpSync() {
    if (!apiClient.isAuthenticated()) return;
    Promise.allSettled([
      apiClient.listOrders('active'),
      apiClient.getTables(),
      apiClient.listCounterOrdersToday(),
    ]).then(([ordersRes, tablesRes, counterRes]) => {
      if (ordersRes.status === 'fulfilled') {
        store.dispatch(setActiveOrders(ordersRes.value?.orders ?? []));
      }
      if (tablesRes.status === 'fulfilled') {
        store.dispatch(setTables(tablesRes.value as RestaurantTable[]));
      }
      if (counterRes.status === 'fulfilled') {
        store.dispatch(setCounterOrders(counterRes.value?.orders ?? []));
      }
    });
  }

  useEffect(() => {
    apiClient.getRestaurantProfile().then((profile) => {
      dispatch(setProfile(profile));
    }).catch(() => {});

    wsService.connect();

    const unsubWsConnect = wsService.on('connected' as Parameters<typeof wsService.on>[0], () => {
      runCatchUpSync();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsService.isConnected()) {
          apiClient.refreshAccessToken().catch(() => {}).finally(() => {
            wsService.forceReconnect();
          });
        }
        runCatchUpSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const unsubscribe = [
      wsService.on('order_created', (data) => {
        const orderId = (data.order_id ?? data.id) as string | undefined;
        if (!orderId) return;
        const counter = isCounterOrder(data);
        const order = { ...data, id: orderId } as unknown as Order;

        if (counter) {
          dispatch(upsertCounterOrder(order));
        } else {
          dispatch(upsertActiveOrder(order));
          const tableId = (data.table_id ?? data.tableId) as string | undefined;
          if (tableId) dispatch(setTableOccupied({ tableId, isOccupied: true, currentOrderId: orderId }));
        }
        const items = (data as { items?: unknown[] }).items;
        if (!items?.length) hydrateOrder(orderId, counter, dispatch);
      }),

      wsService.on('order_updated', (data) => {
        upsertOrderFromWsEvent(data, dispatch);
      }),

      wsService.on('order_status_changed', (data) => {
        upsertOrderFromWsEvent(data, dispatch);
      }),

      wsService.on('order_item_status_changed', (data) => {
        // Backend sends snake_case or camelCase depending on event path
        const orderId = (data.order_id ?? data.orderId ?? data.id) as string | undefined;
        if (!orderId) return;
        const counter = isCounterOrder(data);

        // Optimistic single-item patch (works when order+items already in Redux)
        const itemId = (data.item_id ?? data.itemId) as string | undefined;
        const status = data.status as string | undefined;
        if (itemId && status) {
          dispatch(patchOrderItemStatus({ orderId, itemId, status }));
        }

        // Always fetch the full order so items are authoritative.
        // The /orders/summary endpoint omits items[], so the patch above may hit an
        // empty array. The hydrate ensures we always get up-to-date statuses.
        hydrateOrder(orderId, counter, dispatch);
      }),

      wsService.on('order_completed', (data) => {
        const orderId = (data.id ?? data.order_id) as string | undefined;
        if (!orderId) return;
        dispatch(removeActiveOrder(orderId));
        dispatch(removeCounterOrder(orderId));
        const tableId = (data.table_id ?? data.tableId) as string | undefined;
        if (tableId) dispatch(setTableOccupied({ tableId, isOccupied: false }));
      }),

      wsService.on('order_cancelled', (data) => {
        const orderId = (data.id ?? data.order_id) as string | undefined;
        if (!orderId) return;
        dispatch(removeActiveOrder(orderId));
        dispatch(removeCounterOrder(orderId));
        const tableId = (data.table_id ?? data.tableId) as string | undefined;
        if (tableId) dispatch(setTableOccupied({ tableId, isOccupied: false }));
      }),

      wsService.on('table_status_changed', (data) => {
        const tableId = (data.table_id ?? data.tableId) as string | undefined;
        if (tableId !== undefined) {
          const isOccupied = Boolean(data.is_occupied ?? data.isOccupied);
          const currentOrderId = (data.current_order_id ?? data.currentOrderId) as string | null | undefined;
          dispatch(setTableOccupied({ tableId, isOccupied, currentOrderId: currentOrderId ?? null }));
        }
        if (data.table) dispatch(upsertTable(data.table as unknown as RestaurantTable));
      }),

      wsService.on('inventory_updated', (data) => {
        const id = (data.ingredient_id ?? data.id) as string | undefined;
        if (id) dispatch(upsertInventoryIngredient({ ...data, id } as unknown as InventoryIngredient));
      }),

      wsService.on('menu_updated', (data) => {
        const action = String(data.action || 'updated').toLowerCase();
        if (action === 'deleted') {
          const id = (data.menu_item_id ?? data.menuItemId) as string | undefined;
          if (id) dispatch(removeMenuItem(id));
          return;
        }
        const item = (data.menu_item ?? data) as unknown as MenuItem;
        if (!item?.id) return;
        dispatch(action === 'created' ? addMenuItem(item) : updateMenuItem(item));
      }),
    ];

    return () => {
      unsubscribe.forEach((fn) => fn());
      unsubWsConnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [dispatch]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 h-full">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-gray-900">BillGenie</span>
        </header>

        <SubscriptionBanner />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
