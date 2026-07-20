import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { Order } from '../services/api';

interface OrdersState {
  activeOrders: Order[];
  counterOrders: Order[];
  hydrated: boolean;
  /** Waiter viewed these cancelled line ids — clears rose tile until new cancels arrive. */
  acknowledgedCancelledByOrderId: Record<string, string[]>;
}

const initialState: OrdersState = {
  activeOrders: [],
  counterOrders: [],
  hydrated: false,
  acknowledgedCancelledByOrderId: {},
};

// Higher rank = more advanced status; prevents WS events from reverting optimistic updates.
// cancelled is terminal for a line item (kitchen void) so it outranks prep statuses.
const STATUS_RANK: Record<string, number> = {
  pending: 0, cooking: 1, ready: 2, served: 3, completed: 4, cancelled: 5,
};

function upsertOrder(list: Order[], incoming: Order): Order[] {
  const index = list.findIndex((o) => o.id === incoming.id);
  if (index >= 0) {
    const updated = [...list];
    const existing = updated[index];
    // Max-status merge: WS partial payloads must not revert a locally-optimistic 'ready' item
    const existingItems = existing.items ?? [];
    const mergedItems = incoming.items?.length
      ? incoming.items.map((inc) => {
          const loc = existingItems.find((i) => i.id === inc.id);
          if (!loc) return inc;
          return (STATUS_RANK[inc.status] ?? 0) >= (STATUS_RANK[loc.status] ?? 0)
            ? inc
            : { ...inc, status: loc.status };
        })
      : existingItems;
    updated[index] = { ...existing, ...incoming, items: mergedItems } as Order;
    return updated;
  }
  return [...list, incoming];
}

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setActiveOrders(state, action: PayloadAction<Order[]>) {
      state.activeOrders = action.payload;
      state.hydrated = true;
    },
    upsertActiveOrder(state, action: PayloadAction<Order>) {
      state.activeOrders = upsertOrder(state.activeOrders, action.payload) as typeof state.activeOrders;
    },
    removeActiveOrder(state, action: PayloadAction<string>) {
      state.activeOrders = state.activeOrders.filter((o) => o.id !== action.payload);
      delete state.acknowledgedCancelledByOrderId[action.payload];
    },
    setCounterOrders(state, action: PayloadAction<Order[]>) {
      state.counterOrders = action.payload;
    },
    upsertCounterOrder(state, action: PayloadAction<Order>) {
      state.counterOrders = upsertOrder(state.counterOrders, action.payload) as typeof state.counterOrders;
    },
    removeCounterOrder(state, action: PayloadAction<string>) {
      state.counterOrders = state.counterOrders.filter((o) => o.id !== action.payload);
      delete state.acknowledgedCancelledByOrderId[action.payload];
    },
    patchOrderItemStatus(
      state,
      action: PayloadAction<{ orderId: string; itemId: string; status: string }>
    ) {
      const { orderId, itemId, status } = action.payload;
      const incomingRank = STATUS_RANK[status] ?? 0;
      // Patch whichever slice contains the order; apply max-status guard
      for (const list of [state.activeOrders, state.counterOrders]) {
        const order = list.find((o) => o.id === orderId);
        if (order) {
          const item = (order.items ?? []).find((i) => i.id === itemId);
          if (item && incomingRank >= (STATUS_RANK[item.status] ?? 0)) {
            item.status = status;
          }
          if (status === 'cancelled') {
            const prev = state.acknowledgedCancelledByOrderId[orderId] || [];
            state.acknowledgedCancelledByOrderId[orderId] = prev.filter((id) => id !== itemId);
          }
          return;
        }
      }
    },
    acknowledgeKitchenCancels(state, action: PayloadAction<{ orderId: string }>) {
      const { orderId } = action.payload;
      const order =
        state.activeOrders.find((o) => o.id === orderId) ??
        state.counterOrders.find((o) => o.id === orderId);
      if (!order) return;
      state.acknowledgedCancelledByOrderId[orderId] = (order.items ?? [])
        .filter((i) => i.status === 'cancelled')
        .map((i) => i.id);
    },
    clearOrders(state) {
      state.activeOrders = [];
      state.counterOrders = [];
      state.hydrated = false;
      state.acknowledgedCancelledByOrderId = {};
    },
  },
});

export const {
  setActiveOrders,
  upsertActiveOrder,
  removeActiveOrder,
  setCounterOrders,
  upsertCounterOrder,
  removeCounterOrder,
  patchOrderItemStatus,
  acknowledgeKitchenCancels,
  clearOrders,
} = ordersSlice.actions;

export const selectActiveOrders = (state: RootState) => state.orders.activeOrders;
export const selectCounterOrders = (state: RootState) => state.orders.counterOrders;
export const selectOrdersHydrated = (state: RootState) => state.orders.hydrated;
export const selectAcknowledgedCancelledByOrderId = (state: RootState) =>
  state.orders.acknowledgedCancelledByOrderId;

export const selectOrderById = createSelector(
  [selectActiveOrders, selectCounterOrders, (_: RootState, id: string) => id],
  (active, counter, id) => active.find((o) => o.id === id) ?? counter.find((o) => o.id === id)
);

export const selectActiveOrderCount = createSelector(
  [selectActiveOrders],
  (orders) => orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length
);

export default ordersSlice.reducer;
