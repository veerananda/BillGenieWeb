import type { AuthResponse } from '../services/api';
import {
  clearAccessToken,
  clearLegacyRefreshToken,
  getAccessToken,
  setAccessToken,
} from './tokenStorage';

const KEYS = {
  role: 'user_role',
  name: 'user_name',
  restaurantId: 'restaurant_id',
  userId: 'user_id',
  canCancelOrders: 'can_cancel_orders',
  canRestockInventory: 'can_restock_inventory',
  canDeductInventory: 'can_deduct_inventory',
  menuManagementAccess: 'menu_management_access',
} as const;

export function getToken(): string | null {
  return getAccessToken();
}

export function getRole(): string | null {
  return localStorage.getItem(KEYS.role);
}

export function getRestaurantId(): string | null {
  return localStorage.getItem(KEYS.restaurantId);
}

export function setAuth(response: AuthResponse): void {
  if (!response?.access_token) return;
  setAccessToken(response.access_token);
  // Refresh lives in httpOnly cookie from the API; drop any legacy JS-readable copy.
  clearLegacyRefreshToken();
  if (response.role) localStorage.setItem(KEYS.role, response.role);
  if (response.name) localStorage.setItem(KEYS.name, response.name);
  if (response.restaurant_id) localStorage.setItem(KEYS.restaurantId, response.restaurant_id);
  if (response.user_id) localStorage.setItem(KEYS.userId, response.user_id);
  localStorage.setItem(KEYS.canCancelOrders, response.can_cancel_orders ? 'true' : 'false');
  localStorage.setItem(KEYS.canRestockInventory, response.can_restock_inventory ? 'true' : 'false');
  localStorage.setItem(KEYS.canDeductInventory, response.can_deduct_inventory ? 'true' : 'false');
  localStorage.setItem(KEYS.menuManagementAccess, response.menu_management_access ? 'true' : 'false');
}

export function clearAuth(): void {
  clearAccessToken();
  clearLegacyRefreshToken();
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
