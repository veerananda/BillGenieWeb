import { createSlice, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { Order } from '../services/api';

interface OrdersState {
  activeOrders: Order[];
  counterOrders: Order[];
  hydrated: boolean;
}

const initialState: OrdersState = {
  activeOrders: [],
  counterOrders: [],
  hydrated: false,
};

// Higher rank = more advanced status; prevents WS events from reverting optimistic updates
const STATUS_RANK: Record<string, number> = {
  pending: 0, cooking: 1, ready: 2, served: 3, completed: 4,
};

function upsertOrder(list: Order[], incoming: Order): Order[] {
  const index = list.findIndex((o) => o.id === incoming.id);
  if (index >= 0) {
    const updated = [...list];
    const existing = updated[index];
    // Max-status merge: WS partial payloads must not revert a locally-optimistic 'ready' item
    const mergedItems = incoming.items?.length
      ? incoming.items.map((inc) => {
          const loc = existing.items.find((i) => i.id === inc.id);
          if (!loc) return inc;
          return (STATUS_RANK[inc.status] ?? 0) >= (STATUS_RANK[loc.status] ?? 0)
            ? inc
            : { ...inc, status: loc.status };
        })
      : existing.items;
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
    },
    setCounterOrders(state, action: PayloadAction<Order[]>) {
      state.counterOrders = action.payload;
    },
    upsertCounterOrder(state, action: PayloadAction<Order>) {
      state.counterOrders = upsertOrder(state.counterOrders, action.payload) as typeof state.counterOrders;
    },
    removeCounterOrder(state, action: PayloadAction<string>) {
      state.counterOrders = state.counterOrders.filter((o) => o.id !== action.payload);
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
          const item = order.items.find((i) => i.id === itemId);
          if (item && incomingRank >= (STATUS_RANK[item.status] ?? 0)) {
            item.status = status;
          }
          return;
        }
      }
    },
    clearOrders(state) {
      state.activeOrders = [];
      state.counterOrders = [];
      state.hydrated = false;
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
  clearOrders,
} = ordersSlice.actions;

export const selectActiveOrders = (state: RootState) => state.orders.activeOrders;
export const selectCounterOrders = (state: RootState) => state.orders.counterOrders;
export const selectOrdersHydrated = (state: RootState) => state.orders.hydrated;

export const selectOrderById = createSelector(
  [selectActiveOrders, selectCounterOrders, (_: RootState, id: string) => id],
  (active, counter, id) => active.find((o) => o.id === id) ?? counter.find((o) => o.id === id)
);

export const selectActiveOrderCount = createSelector(
  [selectActiveOrders],
  (orders) => orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled').length
);

export default ordersSlice.reducer;
