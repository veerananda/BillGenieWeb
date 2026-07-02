import type { AuthResponse } from '../services/api';

const KEYS = {
  token: 'auth_token',
  refresh: 'refresh_token',
  role: 'user_role',
  name: 'user_name',
  restaurantId: 'restaurant_id',
  userId: 'user_id',
  canCancelOrders: 'can_cancel_orders',
  canRestockInventory: 'can_restock_inventory',
} as const;

export function getToken(): string | null {
  return localStorage.getItem(KEYS.token);
}

export function getRole(): string | null {
  return localStorage.getItem(KEYS.role);
}

export function getRestaurantId(): string | null {
  return localStorage.getItem(KEYS.restaurantId);
}

export function setAuth(response: AuthResponse): void {
  if (!response?.access_token) return;
  localStorage.setItem(KEYS.token, response.access_token);
  if (response.refresh_token) localStorage.setItem(KEYS.refresh, response.refresh_token);
  if (response.role) localStorage.setItem(KEYS.role, response.role);
  if (response.name) localStorage.setItem(KEYS.name, response.name);
  if (response.restaurant_id) localStorage.setItem(KEYS.restaurantId, response.restaurant_id);
  if (response.user_id) localStorage.setItem(KEYS.userId, response.user_id);
  localStorage.setItem(KEYS.canCancelOrders, response.can_cancel_orders ? 'true' : 'false');
  localStorage.setItem(KEYS.canRestockInventory, response.can_restock_inventory ? 'true' : 'false');
}

export function clearAuth(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
