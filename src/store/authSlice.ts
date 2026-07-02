import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse } from '../services/api';
import type { RootState } from './index';

interface AuthState {
  token: string | null;
  role: 'admin' | 'manager' | 'staff' | 'chef' | null;
  name: string | null;
  canCancelOrders: boolean;
  canRestockInventory: boolean;
  restaurantId: string | null;
  subscriptionExpired: boolean;
}

const initialState: AuthState = {
  token: localStorage.getItem('auth_token'),
  role: localStorage.getItem('user_role') as AuthState['role'],
  name: localStorage.getItem('user_name'),
  canCancelOrders: localStorage.getItem('can_cancel_orders') === 'true',
  canRestockInventory: localStorage.getItem('can_restock_inventory') === 'true',
  restaurantId: localStorage.getItem('restaurant_id'),
  subscriptionExpired: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<AuthResponse>) {
      const r = action.payload;
      state.token = r.access_token;
      state.role = (r.role as AuthState['role']) ?? null;
      state.name = r.name ?? null;
      state.canCancelOrders = r.can_cancel_orders ?? false;
      state.canRestockInventory = r.can_restock_inventory ?? false;
      state.restaurantId = r.restaurant_id ?? null;
      state.subscriptionExpired = false;
    },
    clearAuth(state) {
      state.token = null;
      state.role = null;
      state.name = null;
      state.canCancelOrders = false;
      state.canRestockInventory = false;
      state.restaurantId = null;
      state.subscriptionExpired = false;
    },
    setSubscriptionExpired(state, action: PayloadAction<boolean>) {
      state.subscriptionExpired = action.payload;
    },
  },
});

export const { setAuth, clearAuth, setSubscriptionExpired } = authSlice.actions;

export const selectAuthToken = (state: RootState) => state.auth.token;
export const selectAuthRole = (state: RootState) => state.auth.role;
export const selectAuthName = (state: RootState) => state.auth.name;
export const selectCanCancelOrders = (state: RootState) => state.auth.canCancelOrders;
export const selectCanRestockInventory = (state: RootState) => state.auth.canRestockInventory;
export const selectRestaurantId = (state: RootState) => state.auth.restaurantId;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.token;
export const selectSubscriptionExpired = (state: RootState) => state.auth.subscriptionExpired;

export default authSlice.reducer;
