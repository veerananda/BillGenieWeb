import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthResponse } from '../services/api';
import type { RootState } from './index';
import { getAccessToken } from '../lib/tokenStorage';

interface AuthState {
  token: string | null;
  role: 'admin' | 'manager' | 'staff' | 'chef' | null;
  name: string | null;
  loginId: string | null;
  canCancelOrders: boolean;
  canRestockInventory: boolean;
  canDeductInventory: boolean;
  menuManagementAccess: boolean;
  restaurantId: string | null;
  subscriptionExpired: boolean;
}

const initialState: AuthState = {
  token: getAccessToken(),
  role: localStorage.getItem('user_role') as AuthState['role'],
  name: localStorage.getItem('user_name'),
  loginId: localStorage.getItem('user_login_id'),
  canCancelOrders: localStorage.getItem('can_cancel_orders') === 'true',
  canRestockInventory: localStorage.getItem('can_restock_inventory') === 'true',
  canDeductInventory: localStorage.getItem('can_deduct_inventory') === 'true',
  menuManagementAccess: localStorage.getItem('menu_management_access') === 'true',
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
      const loginId = (r.login_id || r.staff_key || '').trim();
      if (loginId) {
        state.loginId = loginId;
        localStorage.setItem('user_login_id', loginId);
      }
      state.canCancelOrders = r.can_cancel_orders ?? false;
      state.canRestockInventory = r.can_restock_inventory ?? false;
      state.canDeductInventory = r.can_deduct_inventory ?? false;
      state.menuManagementAccess = r.menu_management_access ?? false;
      state.restaurantId = r.restaurant_id ?? null;
      state.subscriptionExpired = false;
    },
    clearAuth(state) {
      state.token = null;
      state.role = null;
      state.name = null;
      state.loginId = null;
      state.canCancelOrders = false;
      state.canRestockInventory = false;
      state.canDeductInventory = false;
      state.menuManagementAccess = false;
      state.restaurantId = null;
      state.subscriptionExpired = false;
    },
    setSubscriptionExpired(state, action: PayloadAction<boolean>) {
      state.subscriptionExpired = action.payload;
    },
    setLoginId(state, action: PayloadAction<string>) {
      const id = action.payload.trim();
      state.loginId = id || null;
      if (id) localStorage.setItem('user_login_id', id);
    },
  },
});

export const { setAuth, clearAuth, setSubscriptionExpired, setLoginId } = authSlice.actions;

export const selectAuthToken = (state: RootState) => state.auth.token;
export const selectAuthRole = (state: RootState) => state.auth.role;
export const selectAuthName = (state: RootState) => state.auth.name;
export const selectAuthLoginId = (state: RootState) => state.auth.loginId;
export const selectCanCancelOrders = (state: RootState) => state.auth.canCancelOrders;
export const selectCanRestockInventory = (state: RootState) => state.auth.canRestockInventory;
export const selectCanDeductInventory = (state: RootState) => state.auth.canDeductInventory;
export const selectMenuManagementAccess = (state: RootState) => state.auth.menuManagementAccess;
export const selectCanManageMenu = (state: RootState) => {
  const role = state.auth.role;
  if (role === 'admin') return true;
  if (role === 'manager') return state.auth.menuManagementAccess;
  return false;
};
export const selectRestaurantId = (state: RootState) => state.auth.restaurantId;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.token;
export const selectSubscriptionExpired = (state: RootState) => state.auth.subscriptionExpired;

export default authSlice.reducer;
