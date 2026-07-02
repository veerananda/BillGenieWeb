import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAppDispatch } from '../../store/hooks';
import { setProfile } from '../../store/profileSlice';
import apiClient from '../../services/api';
import wsService from '../../services/websocket';
import { upsertActiveOrder, removeActiveOrder } from '../../store/ordersSlice';
import { upsertTable } from '../../store/tablesSlice';
import { upsertInventoryIngredient } from '../../store/inventorySlice';
import { updateMenuItem } from '../../store/menuSlice';
import type { Order, RestaurantTable, MenuItem } from '../../services/api';
import type { InventoryIngredient } from '../../store/inventorySlice';

export function AppShell() {
  const dispatch = useAppDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Bootstrap: fetch profile + connect WS
  useEffect(() => {
    apiClient.getRestaurantProfile().then((profile) => {
      dispatch(setProfile(profile));
    }).catch(() => {});

    wsService.connect();

    const unsubscribe = [
      wsService.on('order_created', (payload) => {
        if (payload.order) dispatch(upsertActiveOrder(payload.order as Order));
      }),
      wsService.on('order_updated', (payload) => {
        if (payload.order) dispatch(upsertActiveOrder(payload.order as Order));
      }),
      wsService.on('order_completed', (payload) => {
        if (payload.order_id) dispatch(removeActiveOrder(payload.order_id as string));
      }),
      wsService.on('order_cancelled', (payload) => {
        if (payload.order_id) dispatch(removeActiveOrder(payload.order_id as string));
      }),
      wsService.on('order_item_status_changed', (payload) => {
        if (payload.order) dispatch(upsertActiveOrder(payload.order as Order));
      }),
      wsService.on('table_status_changed', (payload) => {
        if (payload.table) dispatch(upsertTable(payload.table as RestaurantTable));
      }),
      wsService.on('inventory_updated', (payload) => {
        if (payload.ingredient) dispatch(upsertInventoryIngredient(payload.ingredient as InventoryIngredient));
      }),
      wsService.on('menu_updated', (payload) => {
        if (payload.menu_item) dispatch(updateMenuItem(payload.menu_item as MenuItem));
      }),
    ];

    return () => {
      unsubscribe.forEach((fn) => fn());
    };
  }, [dispatch]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0">
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

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-gray-900">BillGenie</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
