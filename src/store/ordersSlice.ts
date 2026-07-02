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

function upsertOrder(list: Order[], incoming: Order): Order[] {
  const index = list.findIndex((o) => o.id === incoming.id);
  if (index >= 0) {
    const updated = [...list];
    updated[index] = { ...updated[index], ...incoming };
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
