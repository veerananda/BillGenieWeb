/**
 * API Client Service for Web
 * Ported from BillGenieFrontEnd/src/services/api.ts
 * Changes: AsyncStorage → localStorage, EXPO_PUBLIC_* → VITE_*, no RN dependencies
 */

import { showSubscriptionPaywall } from '../lib/subscriptionPaywall';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://billgenie-api.fly.dev';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const RESTAURANT_ID_KEY = 'restaurant_id';
const USER_ID_KEY = 'user_id';
const USER_NAME_KEY = 'user_name';
const USER_ROLE_KEY = 'user_role';
const CAN_CANCEL_ORDERS_KEY = 'can_cancel_orders';
const CAN_RESTOCK_INVENTORY_KEY = 'can_restock_inventory';
const MENU_MANAGEMENT_ACCESS_KEY = 'menu_management_access';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthCredentials {
  identifier: string;
  password: string;
}

export interface RegisterData {
  restaurant_name: string;
  owner_name: string;
  email: string;
  phone: string;
  password: string;
  login_id: string;
  start_mode: 'trial' | 'paid';
  address?: string;
  city?: string;
  cuisine?: string;
  subscription?: import('../data/pricing').SubscriptionSelection;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  restaurant_id: string;
  user_id: string;
  role: string;
  name?: string;
  staff_key?: string;
  login_id?: string;
  restaurant_code?: string;
  can_cancel_orders?: boolean;
  can_restock_inventory?: boolean;
  menu_management_access?: boolean;
  id?: string;
  code?: string;
}

export interface RegisterResponse {
  restaurant_id: string;
  restaurant_code: string;
  email: string;
  login_id: string;
  requires_email_verification: boolean;
  is_email_verified: boolean;
  verification_email_sent: boolean;
  message: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_number: number | string;
  table_id?: string;
  order_number: number;
  ticket_number?: number;
  order_type?: 'dine_in' | 'counter';
  service_mode?: 'eat_here' | 'takeaway';
  customer_name?: string;
  customer_phone?: string;
  status: string;
  sub_total: number;
  tax_amount: number;
  discount_amount?: number;
  total: number;
  payment_method?: string;
  amount_received?: number;
  change_returned?: number;
  cash_amount?: number;
  upi_amount?: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  tracking_token?: string;
  tracking_url?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string;
  quantity: number;
  unit_rate: number;
  total: number;
  status: string;
  notes?: string;
  sub_id?: string;
  created_at?: string;
  menu_item?: { id: string; name: string; category?: string; price?: number };
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
  cost_price?: number;
  is_veg: boolean;
  is_available: boolean;
  readily_available?: boolean;
}

export interface Ingredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  current_stock: number;
  full_stock: number;
  alert_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRenewalQuote {
  billing_cycle: 'monthly' | 'annual';
  subtotal_inr: number;
  gst_inr: number;
  total_inr: number;
  amount_paise: number;
  line_items: { id: string; label: string; amount: number }[];
  subscription_end?: string;
  is_expired?: boolean;
  days_remaining?: number;
  subscription_phase?: string;
  requires_plan_selection?: boolean;
  requires_payment?: boolean;
  current_selection?: import('../data/pricing').SubscriptionSelection;
}

export interface SubscriptionRenewalOrder {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  billing_cycle: 'monthly' | 'annual';
  total_inr: number;
  subtotal_inr: number;
  gst_inr: number;
  dev_mode?: boolean;
}

export interface SubscriptionVerifyResult {
  subscription_end: string;
  message: string;
}

export interface RestaurantProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  contact_number: string;
  email: string;
  upi_id: string;
  upi_qr_code: string;
  city: string;
  cuisine: string;
  is_self_service: boolean;
  counter_service_modes?: 'both' | 'eat_here' | 'takeaway';
  prices_include_gst?: boolean;
  is_closed?: boolean;
  subscription_end?: string;
  subscription_phase?: string;
  requires_plan_selection?: boolean;
  can_change_plan?: boolean;
  pending_selection?: import('../data/pricing').SubscriptionSelection | null;
  pending_change_at?: string | null;
  subscription_plan?: string;
  subscription_monthly_price?: number;
  subscription_config?: unknown;
  subscription_selection?: import('../data/pricing').SubscriptionSelection;
  subscription_limits?: import('../lib/subscriptionLimits').SubscriptionLimits;
  subscription_usage?: import('../lib/subscriptionLimits').SubscriptionUsage;
}

export interface UpdateProfileRequest {
  name?: string;
  address?: string;
  contact_number?: string;
  upi_id?: string;
  upi_qr_code?: string;
  is_self_service?: boolean;
  counter_service_modes?: 'both' | 'eat_here' | 'takeaway';
  prices_include_gst?: boolean;
  is_closed?: boolean;
}

export interface CompletePaymentRequest {
  payment_method: 'cash' | 'upi' | 'split';
  amount_received?: number;
  change_returned?: number;
  cash_amount?: number;
  upi_amount?: number;
  upi_transaction_id?: string;
  discount_amount?: number;
}

export interface CompletePaymentResponse {
  message: string;
  order: Order;
  tracking_token?: string;
  tracking_url?: string;
  ticket_number?: number;
}

export interface CreateOrderRequest {
  table_number?: string;
  order_type?: 'dine_in' | 'counter';
  service_mode?: 'eat_here' | 'takeaway';
  order_number?: number;
  customer_name?: string;
  customer_phone?: string;
  table_id?: string;
  items?: { menu_item_id: string; quantity: number; notes?: string }[];
  notes?: string;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  name: string;
  is_occupied: boolean;
  current_order_id?: string;
  capacity?: number;
  assistance_token?: string;
  assistance_requested_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'manager' | 'staff' | 'chef';
  staff_key?: string;
  can_cancel_orders?: boolean;
  can_restock_inventory?: boolean;
  menu_management_access?: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface MenuItemIngredient {
  id: string;
  restaurant_id?: string;
  menu_item_id: string;
  ingredient_id?: string;
  name: string;
  unit: string;
  quantity_used: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeIngredientInput {
  ingredient_id?: string;
  name: string;
  unit: string;
  quantity_used: number;
}

export type SupportIssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportIssueCategory = 'query' | 'problem' | 'other';

export interface SupportIssueScreenshot {
  data_url: string;
  name: string;
  content_type: string;
}

export interface SupportIssue {
  id: string;
  restaurant_id: string;
  restaurant_name?: string;
  restaurant_code?: string;
  user_id?: string;
  reporter_name?: string;
  reporter_role?: string;
  category: SupportIssueCategory;
  title: string;
  description: string;
  screenshot_count?: number;
  screenshot_data_url?: string;
  screenshot_name?: string;
  screenshot_content_type?: string;
  screenshots?: SupportIssueScreenshot[];
  status: SupportIssueStatus;
  resolution_note?: string;
  resolved_by?: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CreateSupportIssueRequest {
  category: SupportIssueCategory;
  title: string;
  description: string;
  screenshots?: SupportIssueScreenshot[];
  screenshot_data_url?: string;
  screenshot_name?: string;
  screenshot_content_type?: string;
}

// ─── API Client ───────────────────────────────────────────────────────────────

class APIClient {
  private async makeRequest(
    endpoint: string,
    method = 'GET',
    body?: unknown,
    options: { skipRetry?: boolean; silent?: boolean } = {}
  ): Promise<any> {
    const { skipRetry = false, silent = false } = options;
    const token = localStorage.getItem(TOKEN_KEY);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const config: RequestInit = { method, headers };
    if (body !== undefined) config.body = JSON.stringify(body);

    const fullUrl = `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(fullUrl, config);

      if (response.status === 401 && !skipRetry && !endpoint.startsWith('/auth/')) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          const newToken = localStorage.getItem(TOKEN_KEY);
          const retryHeaders = { ...headers };
          if (newToken) retryHeaders.Authorization = `Bearer ${newToken}`;
          const retry = await fetch(fullUrl, { ...config, headers: retryHeaders });
          if (retry.ok) {
            const parsed = await retry.json().catch(() => null);
            return parsed?.data ?? parsed;
          }
        }
        this.logout();
        sessionStorage.setItem('logout_reason', 'device_conflict');
        window.location.replace('/login');
        throw new Error('Logged out.');
      }

      if (response.status === 402) {
        const err = await response.json().catch(() => ({}));
        showSubscriptionPaywall();
        const message =
          typeof err.message === 'string'
            ? err.message
            : err.error === 'subscription_expired'
              ? 'Complete payment to activate your BillGenie subscription.'
              : typeof err.error === 'string'
                ? err.error
                : 'Complete payment to activate your BillGenie subscription.';
        throw new Error(message);
      }

      if (response.status === 403) {
        const err = await response.json().catch(() => ({}));
        const code = typeof err.error === 'string' ? err.error : '';
        const message =
          typeof err.message === 'string'
            ? err.message
            : typeof err.error === 'string'
              ? err.error
              : 'Access denied';
        if (code === 'restaurant_closed') {
          const role = localStorage.getItem('user_role');
          if (role && role !== 'admin') {
            this.logout();
            sessionStorage.setItem('logout_reason', 'restaurant_closed');
            window.location.replace('/login');
          }
        }
        throw new Error(message);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? err.error ?? `Request failed: ${response.status}`);
      }

      const parsed = await response.json().catch(() => null);
      return parsed?.data ?? parsed;
    } catch (error) {
      if (!silent) console.error(`[API] ${method} ${fullUrl} failed:`, error);
      throw error;
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    const response = await this.makeRequest('/auth/login', 'POST', credentials);
    const payload: AuthResponse = response?.data ?? response;
    this.storeAuthData(payload);
    return payload;
  }

  async register(data: RegisterData): Promise<RegisterResponse> {
    return this.makeRequest('/auth/register', 'POST', data);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.makeRequest('/auth/reset-password', 'POST', {
      token,
      new_password: newPassword,
    });
  }

  async forgotPassword(identifier: string): Promise<{ message: string }> {
    return this.makeRequest('/auth/forgot-password', 'POST', { identifier });
  }

  async requestLoginRecovery(identifier: string): Promise<{ message: string }> {
    const response = await this.makeRequest('/auth/forgot-login-id', 'POST', { identifier });
    return response?.data ?? response;
  }

  async verifyLoginRecovery(identifier: string, otp: string): Promise<{ login_id: string; message: string }> {
    const response = await this.makeRequest('/auth/verify-login-recovery', 'POST', { identifier, otp });
    return response?.data ?? response;
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const query = `token=${encodeURIComponent(token)}`;
    return this.makeRequest(`/auth/verify-email?${query}`, 'POST');
  }

  async getVerificationStatus(
    restaurantId: string,
    email: string
  ): Promise<{ is_email_verified: boolean }> {
    const query = `restaurant_id=${encodeURIComponent(restaurantId)}&email=${encodeURIComponent(email)}`;
    return this.makeRequest(`/auth/verification-status?${query}`, 'GET');
  }

  async resendVerificationEmail(restaurantId: string, email: string): Promise<{ message: string }> {
    const query = `restaurant_id=${encodeURIComponent(restaurantId)}&email=${encodeURIComponent(email)}`;
    return this.makeRequest(`/auth/resend-verification?${query}`, 'POST');
  }

  logout(): void {
    [TOKEN_KEY, REFRESH_TOKEN_KEY, RESTAURANT_ID_KEY, USER_ID_KEY, USER_NAME_KEY, USER_ROLE_KEY, CAN_CANCEL_ORDERS_KEY, CAN_RESTOCK_INVENTORY_KEY, MENU_MANAGEMENT_ACCESS_KEY].forEach((k) =>
      localStorage.removeItem(k)
    );
  }

  async getAuthProfile(): Promise<{ name?: string; role?: string; user_id?: string }> {
    const r = await this.makeRequest('/auth/profile');
    return r?.data ?? r;
  }

  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;
      const r = await this.makeRequest('/auth/refresh', 'POST', { refresh_token: refreshToken }, { skipRetry: true });
      this.storeAuthData(r?.data ?? r);
      return true;
    } catch {
      return false;
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  getAuthToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private storeAuthData(authData: AuthResponse): void {
    if (!authData?.access_token) return;
    localStorage.setItem(TOKEN_KEY, authData.access_token);
    if (authData.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, authData.refresh_token);
    if (authData.restaurant_id) localStorage.setItem(RESTAURANT_ID_KEY, authData.restaurant_id);
    if (authData.user_id) localStorage.setItem(USER_ID_KEY, authData.user_id);
    if (authData.role) localStorage.setItem(USER_ROLE_KEY, authData.role);
    if (authData.name) localStorage.setItem(USER_NAME_KEY, authData.name);
    localStorage.setItem(CAN_CANCEL_ORDERS_KEY, authData.can_cancel_orders ? 'true' : 'false');
    localStorage.setItem(CAN_RESTOCK_INVENTORY_KEY, authData.can_restock_inventory ? 'true' : 'false');
    localStorage.setItem(MENU_MANAGEMENT_ACCESS_KEY, authData.menu_management_access ? 'true' : 'false');
  }

  // ── Menu ──────────────────────────────────────────────────────────────────

  async listMenuItems(): Promise<MenuItem[]> {
    const r = await this.makeRequest('/menu');
    return r?.menu_items ?? r ?? [];
  }

  async createMenuItem(data: Partial<MenuItem>): Promise<MenuItem> {
    const r = await this.makeRequest('/menu', 'POST', data);
    return r?.menu_item ?? r ?? {};
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    const r = await this.makeRequest(`/menu/${id}`, 'PUT', data);
    return r?.menu_item ?? r ?? {};
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.makeRequest(`/menu/${id}`, 'DELETE');
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  async createOrder(order: CreateOrderRequest): Promise<Order> {
    const r = await this.makeRequest('/orders', 'POST', order);
    return r?.order ?? r;
  }

  async getOrder(id: string): Promise<Order> {
    const r = await this.makeRequest(`/orders/${id}`);
    return r?.order ?? r;
  }

  async listOrders(status?: string, limit = 50, offset = 0): Promise<{ orders: Order[]; total: number }> {
    const p = new URLSearchParams();
    if (status) p.append('status', status);
    p.append('limit', String(limit));
    p.append('offset', String(offset));
    return this.makeRequest(`/orders?${p}`);
  }

  async listOrdersSummary(status = 'active', limit = 50): Promise<{ orders: Order[]; total: number }> {
    const p = new URLSearchParams({ status, limit: String(limit) });
    try {
      return await this.makeRequest(`/orders/summary?${p}`);
    } catch {
      return this.listOrders(status, limit);
    }
  }

  async listCounterOrdersToday(): Promise<{ orders: Order[]; total: number }> {
    try {
      return await this.makeRequest('/orders/counter/today');
    } catch {
      return { orders: [], total: 0 };
    }
  }

  async getNextCounterTicket(): Promise<number> {
    const r = await this.makeRequest('/orders/counter/next-ticket');
    return r?.ticket_number ?? 1;
  }

  async updateOrder(id: string, order: CreateOrderRequest): Promise<Order> {
    const r = await this.makeRequest(`/orders/${id}`, 'PUT', order);
    return r?.order ?? r;
  }

  async cancelOrder(id: string): Promise<void> {
    await this.makeRequest(`/orders/${id}/cancel`, 'PUT');
  }

  async startCheckout(id: string): Promise<void> {
    await this.makeRequest(`/orders/${id}/checkout/start`, 'POST', {});
  }

  async cancelCheckout(id: string): Promise<void> {
    try {
      await this.makeRequest(`/orders/${id}/checkout/cancel`, 'POST', {}, { silent: true });
    } catch { /* best-effort */ }
  }

  async createBillShare(
    id: string,
    discountAmount = 0,
  ): Promise<{ bill_token: string; bill_url: string; expires_at?: string }> {
    return this.makeRequest(`/orders/${id}/bill-share`, 'POST', {
      discount_amount: discountAmount,
    });
  }

  async updateOrderItemStatus(orderId: string, itemId: string, status: 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled'): Promise<void> {
    await this.makeRequest(`/orders/${orderId}/items/${itemId}/status`, 'PUT', { status });
  }

  async dismissCancelledOrderItem(orderId: string, itemId: string): Promise<void> {
    await this.makeRequest(`/orders/${orderId}/items/${itemId}`, 'DELETE');
  }

  /** Manager/admin: set line quantity (0 removes the item). Restores stock server-side. */
  async adjustOrderItemQuantity(orderId: string, itemId: string, quantity: number): Promise<Order> {
    const r = await this.makeRequest(`/orders/${orderId}/items/${itemId}/quantity`, 'PUT', { quantity });
    return (r?.order ?? r) as Order;
  }

  async completeOrderWithPayment(id: string, payment: CompletePaymentRequest): Promise<CompletePaymentResponse> {
    return this.makeRequest(`/orders/${id}/complete-payment`, 'POST', payment);
  }

  async addItemsToOrder(orderId: string, items: { menu_item_id: string; quantity: number; notes?: string }[]): Promise<Order> {
    try {
      const r = await this.makeRequest(`/orders/${orderId}/add-items`, 'POST', { items });
      return r?.order ?? r;
    } catch {
      const r = await this.makeRequest(`/orders/${orderId}`, 'PUT', { items });
      return r?.order ?? r;
    }
  }

  async getSalesSummary(period: 'today' | 'month'): Promise<{ total_revenue: number; total_orders: number; average_order_value: number; period: string }> {
    return this.makeRequest(`/orders/sales-summary?period=${period}`);
  }

  async getSalesAnalytics(period: 'week' | 'last_week' | 'month'): Promise<{
    period: string;
    from: string;
    to: string;
    total_revenue: number;
    total_orders: number;
    average_order_value: number;
    series: Array<{ date: string; label: string; revenue: number; orders: number }>;
    comparison: {
      previous_revenue: number;
      previous_orders: number;
      revenue_change_pct: number;
      orders_change_pct: number;
      direction: 'up' | 'down' | 'flat';
    };
    top_items: Array<{ name: string; category: string; quantity: number; revenue: number }>;
  }> {
    return this.makeRequest(`/orders/sales-analytics?period=${period}`);
  }

  async listOrderHistory(params: { from: string; to: string; order_type?: string; limit?: number; offset?: number }): Promise<{ orders: Order[]; total: number; limit: number; offset: number }> {
    const p = new URLSearchParams({
      from: params.from,
      to: params.to,
      order_type: params.order_type ?? 'all',
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    });
    return this.makeRequest(`/orders/history?${p}`);
  }

  // ── Tables ────────────────────────────────────────────────────────────────

  async getTables(): Promise<RestaurantTable[]> {
    const r = await this.makeRequest('/tables');
    return Array.isArray(r) ? r : r?.tables ?? [];
  }

  async createTable(name: string): Promise<RestaurantTable> {
    return this.makeRequest('/tables', 'POST', { name });
  }

  async createBulkTables(names: string): Promise<{ message: string; count: number; tables: RestaurantTable[] }> {
    return this.makeRequest('/tables/bulk', 'POST', { names });
  }

  async updateTable(id: string, updates: { name?: string; is_occupied?: boolean; capacity?: number }): Promise<RestaurantTable> {
    return this.makeRequest(`/tables/${id}`, 'PUT', updates);
  }

  async deleteTable(id: string): Promise<void> {
    await this.makeRequest(`/tables/${id}`, 'DELETE');
  }

  async setTableOccupied(tableId: string, orderId: string): Promise<RestaurantTable> {
    return this.makeRequest(`/tables/${tableId}/occupy`, 'PUT', { order_id: orderId });
  }

  async setTableVacant(tableId: string): Promise<RestaurantTable> {
    return this.makeRequest(`/tables/${tableId}/vacant`, 'PUT', {});
  }

  async getTableAssistanceQr(tableId: string): Promise<{
    table_id: string;
    table_name: string;
    order_id?: string;
    assistance_token: string;
    assistance_url: string;
  }> {
    return this.makeRequest(`/tables/${tableId}/assistance-qr`);
  }

  async clearTableAssistance(tableId: string): Promise<RestaurantTable> {
    return this.makeRequest(`/tables/${tableId}/clear-assistance`, 'POST', {});
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  async getRestaurantProfile(): Promise<RestaurantProfile> {
    return this.makeRequest('/restaurants/profile');
  }

  async updateRestaurantProfile(data: UpdateProfileRequest): Promise<{ message: string; restaurant: RestaurantProfile }> {
    return this.makeRequest('/restaurants/profile', 'PUT', data);
  }

  /** Admin only — force every other device in the restaurant to sign out. */
  async logoutAllDevices(): Promise<{ message: string; revoked_users: number }> {
    return this.makeRequest('/restaurants/logout-all-devices', 'POST', {});
  }

  // ── Staff ─────────────────────────────────────────────────────────────────

  async listStaff(): Promise<StaffMember[]> {
    const r = await this.makeRequest('/users');
    return r?.staff ?? r?.users ?? (Array.isArray(r) ? r : []);
  }

  async createStaff(data: { name: string; email?: string; phone?: string; role: string; staff_key?: string; password?: string; can_cancel_orders?: boolean; can_restock_inventory?: boolean; menu_management_access?: boolean }): Promise<StaffMember> {
    const r = await this.makeRequest('/users', 'POST', data);
    return r?.staff_member ?? r?.user ?? r;
  }

  async updateStaff(id: string, data: Partial<StaffMember> & { password?: string }): Promise<StaffMember> {
    const r = await this.makeRequest(`/users/${id}`, 'PUT', data);
    return r?.staff_member ?? r?.user ?? r;
  }

  async deleteStaff(id: string): Promise<void> {
    await this.makeRequest(`/users/${id}`, 'DELETE');
  }

  async regenerateStaffKey(id: string): Promise<StaffMember> {
    const r = await this.makeRequest(`/users/${id}/regenerate-key`, 'POST', {});
    return r?.staff_member ?? r?.user ?? r;
  }

  // ── Ingredients / Inventory ───────────────────────────────────────────────

  async listIngredients(): Promise<Ingredient[]> {
    const r = await this.makeRequest('/ingredients');
    return r?.ingredients ?? [];
  }

  async createIngredient(data: {
    name: string;
    unit: string;
    current_stock?: number;
    full_stock?: number;
    alert_quantity?: number;
  }): Promise<Ingredient> {
    const r = await this.makeRequest('/ingredients', 'POST', data);
    return r?.ingredient;
  }

  async updateIngredient(
    id: string,
    data: {
      name?: string;
      unit?: string;
      current_stock?: number;
      full_stock?: number;
      alert_quantity?: number;
    }
  ): Promise<Ingredient> {
    const r = await this.makeRequest(`/ingredients/${id}`, 'PUT', data);
    return r?.ingredient;
  }

  async bulkUpdateIngredients(
    items: Array<{ ingredient_id: string; alert_quantity?: number; full_stock?: number }>
  ): Promise<Ingredient[]> {
    const r = await this.makeRequest('/ingredients/bulk', 'PUT', { items });
    return r?.ingredients ?? [];
  }

  async restockIngredient(id: string, quantity: number): Promise<Ingredient> {
    const r = await this.makeRequest(`/ingredients/${id}/restock`, 'POST', { quantity });
    return r?.ingredient;
  }

  async restockIngredients(
    items: Array<{ ingredient_id: string; quantity: number }>
  ): Promise<Ingredient[]> {
    const r = await this.makeRequest('/ingredients/restock', 'POST', { items });
    return r?.ingredients ?? [];
  }

  async deleteIngredient(id: string): Promise<void> {
    await this.makeRequest(`/ingredients/${id}`, 'DELETE');
  }

  async listMenuItemIngredients(menuItemId?: string): Promise<MenuItemIngredient[]> {
    const query = menuItemId ? `?menu_item_id=${encodeURIComponent(menuItemId)}` : '';
    const r = await this.makeRequest(`/menu-item-ingredients${query}`);
    return r?.menu_item_ingredients ?? [];
  }

  async setMenuItemIngredients(menuItemId: string, ingredients: RecipeIngredientInput[]): Promise<MenuItemIngredient[]> {
    const r = await this.makeRequest(`/menu/${menuItemId}/ingredients`, 'PUT', { ingredients });
    return r?.menu_item_ingredients ?? [];
  }

  // ── Support ───────────────────────────────────────────────────────────────

  async listSupportIssues(status?: SupportIssueStatus): Promise<{ issues: SupportIssue[]; total: number }> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const r = await this.makeRequest(`/support/issues${query}`);
    return { issues: r?.issues ?? [], total: r?.total ?? 0 };
  }

  async createSupportIssue(data: CreateSupportIssueRequest): Promise<SupportIssue> {
    const r = await this.makeRequest('/support/issues', 'POST', data);
    return r?.issue ?? r;
  }

  async getSupportIssueScreenshots(
    issueId: string
  ): Promise<{ screenshots: SupportIssueScreenshot[] }> {
    return this.makeRequest(`/support/issues/${issueId}/screenshots`);
  }

  // ── Subscription / Payment ─────────────────────────────────────────────────

  async getSubscriptionRenewalQuote(
    selection?: import('../data/pricing').SubscriptionSelection
  ): Promise<SubscriptionRenewalQuote> {
    if (selection) {
      return this.makeRequest('/subscription/renewal-quote', 'POST', { selection });
    }
    return this.makeRequest('/subscription/renewal-quote', 'GET');
  }

  async createSubscriptionRenewalOrder(
    selection?: import('../data/pricing').SubscriptionSelection
  ): Promise<SubscriptionRenewalOrder> {
    const body = selection ? { selection } : undefined;
    return this.makeRequest('/subscription/create-order', 'POST', body);
  }

  async verifySubscriptionPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    selection?: import('../data/pricing').SubscriptionSelection;
  }): Promise<SubscriptionVerifyResult> {
    return this.makeRequest('/subscription/verify-payment', 'POST', data);
  }

  async getPlanChangeQuote(
    selection: import('../data/pricing').SubscriptionSelection
  ): Promise<PlanChangeQuote> {
    return this.makeRequest('/subscription/change-quote', 'POST', { selection });
  }

  async createPlanChangeOrder(
    selection: import('../data/pricing').SubscriptionSelection
  ): Promise<SubscriptionRenewalOrder> {
    return this.makeRequest('/subscription/change-order', 'POST', { selection });
  }

  async verifyPlanChangePayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    selection?: import('../data/pricing').SubscriptionSelection;
  }): Promise<SubscriptionVerifyResult> {
    return this.makeRequest('/subscription/verify-change-payment', 'POST', data);
  }

  async schedulePlanChange(
    selection: import('../data/pricing').SubscriptionSelection
  ): Promise<SchedulePlanChangeResult> {
    return this.makeRequest('/subscription/schedule-change', 'POST', { selection });
  }

  async cancelScheduledPlanChange(): Promise<{ message: string }> {
    return this.makeRequest('/subscription/cancel-scheduled-change', 'POST');
  }
}

export interface PlanChangeQuote {
  change_type: 'upgrade' | 'downgrade' | 'noop';
  billing_cycle: 'monthly' | 'annual';
  remaining_days: number;
  period_days: number;
  current_selection: import('../data/pricing').SubscriptionSelection;
  new_selection: import('../data/pricing').SubscriptionSelection;
  current_period_amount_inr: number;
  new_period_amount_inr: number;
  proration_delta_inr: number;
  next_period_amount_inr: number;
  amount_due_inr: number;
  amount_paise: number;
  gst_inr: number;
  subtotal_inr: number;
  line_items: { id: string; label: string; amount: number }[];
  effective_at: string;
  new_subscription_end: string;
  current_subscription_end: string;
  pending_change_at?: string | null;
  has_pending_downgrade?: boolean;
}

export interface SchedulePlanChangeResult {
  message: string;
  pending_selection: import('../data/pricing').SubscriptionSelection;
  pending_change_at: string;
  subscription_end: string;
}

export const apiClient = new APIClient();
export default apiClient;
