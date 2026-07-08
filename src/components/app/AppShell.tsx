import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SubscriptionBanner } from './SubscriptionBanner';
import { Sidebar } from './Sidebar';
import { useAppDispatch } from '../../store/hooks';
import { setProfile } from '../../store/profileSlice';
import apiClient from '../../services/api';
import wsService from '../../services/websocket';
import {
  upsertActiveOrder, removeActiveOrder,
  upsertCounterOrder, removeCounterOrder,
  patchOrderItemStatus,
} from '../../store/ordersSlice';
import { setTableOccupied, upsertTable } from '../../store/tablesSlice';
import { upsertInventoryIngredient } from '../../store/inventorySlice';
import { addMenuItem, updateMenuItem, removeMenuItem } from '../../store/menuSlice';
import type { Order, RestaurantTable, MenuItem } from '../../services/api';
import type { InventoryIngredient } from '../../store/inventorySlice';

function isCounterOrder(data: Record<string, unknown>): boolean {
  return data.order_type === 'counter' || data.orderType === 'counter';
}

export function AppShell() {
  const dispatch = useAppDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bootstrap: fetch profile + connect WS
  useEffect(() => {
    apiClient.getRestaurantProfile().then((profile) => {
      dispatch(setProfile(profile));
    }).catch(() => {});

    wsService.connect();

    // Backend message format: { type, room_id, timestamp, data: {...} }
    // wsService emits message.data as the payload — data IS the order/table/etc. object directly.
    const unsubscribe = [
      // Order events — route to the correct Redux slice based on order_type
      wsService.on('order_created', (data) => {
        if (!data.id) return;
        if (isCounterOrder(data)) {
          dispatch(upsertCounterOrder(data as unknown as Order));
        } else {
          dispatch(upsertActiveOrder(data as unknown as Order));
          const tableId = (data.table_id ?? data.tableId) as string | undefined;
          if (tableId) dispatch(setTableOccupied({ tableId, isOccupied: true, currentOrderId: data.id as string }));
        }
      }),
      wsService.on('order_updated', (data) => {
        if (!data.id) return;
        if (isCounterOrder(data)) {
          dispatch(upsertCounterOrder(data as unknown as Order));
        } else {
          dispatch(upsertActiveOrder(data as unknown as Order));
        }
      }),
      wsService.on('order_status_changed', (data) => {
        if (!data.id) return;
        if (isCounterOrder(data)) {
          dispatch(upsertCounterOrder(data as unknown as Order));
        } else {
          dispatch(upsertActiveOrder(data as unknown as Order));
        }
      }),
      wsService.on('order_item_status_changed', (data) => {
        if (data.id && (data as { items?: unknown[] }).items?.length) {
          // Full order payload — route by order_type
          if (isCounterOrder(data)) {
            dispatch(upsertCounterOrder(data as unknown as Order));
          } else {
            dispatch(upsertActiveOrder(data as unknown as Order));
          }
        } else if (data.order_id && data.item_id && data.status) {
          // Partial update — patchOrderItemStatus checks both slices
          dispatch(patchOrderItemStatus({
            orderId: data.order_id as string,
            itemId: data.item_id as string,
            status: data.status as string,
          }));
        }
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
      // Table events — data has table_id + is_occupied (flat, not a table object)
      wsService.on('table_status_changed', (data) => {
        const tableId = (data.table_id ?? data.tableId) as string | undefined;
        if (tableId !== undefined) {
          const isOccupied = Boolean(data.is_occupied ?? data.isOccupied);
          dispatch(setTableOccupied({ tableId, isOccupied }));
        }
        if (data.table) dispatch(upsertTable(data.table as unknown as RestaurantTable));
      }),
      // Inventory — data has ingredient fields directly
      wsService.on('inventory_updated', (data) => {
        const id = (data.ingredient_id ?? data.id) as string | undefined;
        if (id) dispatch(upsertInventoryIngredient({ ...data, id } as unknown as InventoryIngredient));
      }),
      // Menu — data may wrap in menu_item or be the item directly
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
    };
  }, [dispatch]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar — sticky so it stays in viewport while body scrolls */}
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
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

      {/* Main content — grows naturally; body is the single scroll container */}
      <div className="flex flex-1 flex-col">
        {/* Mobile top bar — sticky so it stays at top while body scrolls */}
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
