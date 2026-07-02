import { useState, useEffect, useCallback } from 'react';
import { Plus, X, Minus, Search, ShoppingCart, ChevronRight, Ticket } from 'lucide-react';
import { apiClient } from '../../services/api';
import type { Order, MenuItem, CompletePaymentRequest } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCounterOrders,
  setCounterOrders,
  upsertCounterOrder,
  removeCounterOrder,
} from '../../store/ordersSlice';
import { selectMenuItems, selectMenuHydrated, setMenuItems } from '../../store/menuSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Badge } from '../../components/app/Badge';
import { Modal } from '../../components/app/Modal';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

type ServiceMode = 'eat_here' | 'takeaway';
type PaymentMethod = 'cash' | 'upi';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusVariant(status: string): 'pending' | 'completed' | 'cancelled' | 'cooking' | 'ready' | 'served' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  onSuccess: (completedOrder: Order) => void;
}

function PaymentModal({ order, open, onClose, onSuccess }: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setAmountReceived('');
      setUpiTxnId('');
      setError(null);
    }
  }, [open]);

  if (!order) return null;

  const orderTotal = order.total;
  const received = parseFloat(amountReceived) || 0;
  const changeDue = method === 'cash' ? Math.max(0, received - orderTotal) : 0;
  const canConfirm =
    method === 'upi' ? true : received >= orderTotal;

  async function handleConfirm() {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      await apiClient.startCheckout(order.id);
      const payload: CompletePaymentRequest =
        method === 'cash'
          ? { payment_method: 'cash', amount_received: received, change_returned: changeDue }
          : { payment_method: 'upi', upi_transaction_id: upiTxnId || undefined };
      const result = await apiClient.completeOrderWithPayment(order.id, payload);
      onSuccess(result.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Complete Payment" maxWidth="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Order #{order.order_number}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(orderTotal)}</p>
        </div>

        {/* Payment method toggle */}
        <div className="flex rounded-xl border border-gray-200 p-1">
          {(['cash', 'upi'] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                method === m
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {m === 'cash' ? 'Cash' : 'UPI'}
            </button>
          ))}
        </div>

        {method === 'cash' ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Amount Received (₹)
              </label>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {received > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                <span className="text-sm font-medium text-green-700">Change Due</span>
                <span className="text-lg font-bold text-green-700">{formatCurrency(changeDue)}</span>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              UPI Transaction ID (optional)
            </label>
            <input
              type="text"
              value={upiTxnId}
              onChange={(e) => setUpiTxnId(e.target.value)}
              placeholder="e.g. UPI1234567890"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={!canConfirm || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
        >
          {loading && <Spinner size="sm" className="text-white" />}
          Confirm Payment
        </button>
      </div>
    </Modal>
  );
}

// ─── New Order Slide-over ─────────────────────────────────────────────────────

interface NewOrderPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
  menuItems: MenuItem[];
}

function NewOrderPanel({ open, onClose, onCreated, menuItems }: NewOrderPanelProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('eat_here');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTicket, setSuccessTicket] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setServiceMode('eat_here');
      setSearch('');
      setError(null);
      setSuccessTicket(null);
      apiClient.getNextCounterTicket().then(setTicketNumber).catch(() => setTicketNumber(null));
    }
  }, [open]);

  const filtered = search.trim()
    ? menuItems.filter(
        (m) =>
          m.is_available &&
          (m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.category.toLowerCase().includes(search.toLowerCase()))
      )
    : menuItems.filter((m) => m.is_available);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQty(menuItemId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  async function handlePlaceOrder() {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const order = await apiClient.createOrder({
        order_type: 'counter',
        service_mode: serviceMode,
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: cart.map((c) => ({ menu_item_id: c.menuItemId, quantity: c.quantity })),
      });
      setSuccessTicket(order.ticket_number ?? null);
      onCreated(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New Counter Order</h2>
            {ticketNumber !== null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <Ticket className="h-3.5 w-3.5" />
                Next ticket: <span className="font-semibold text-primary">#{ticketNumber}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {successTicket !== null ? (
            /* Success state */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Ticket className="h-10 w-10 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Order Placed!</h3>
                <p className="mt-1 text-gray-500">
                  Ticket number{' '}
                  <span className="text-2xl font-bold text-primary">#{successTicket}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-4 rounded-xl bg-primary px-8 py-3 font-semibold text-white"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {/* Customer info */}
                <div className="border-b border-gray-100 px-6 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Service mode toggle */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Service Mode
                    </label>
                    <div className="flex rounded-lg border border-gray-200 p-0.5">
                      {(['eat_here', 'takeaway'] as ServiceMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setServiceMode(mode)}
                          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                            serviceMode === mode
                              ? 'bg-primary text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {mode === 'eat_here' ? 'Eat Here' : 'Takeaway'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Menu search */}
                <div className="border-b border-gray-100 px-6 py-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search menu..."
                      className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Menu items */}
                <div className="divide-y divide-gray-50 px-6">
                  {filtered.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-500">No items found</p>
                  ) : (
                    filtered.map((item) => {
                      const inCart = cart.find((c) => c.menuItemId === item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                                  item.is_veg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'
                                }`}
                              />
                              <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                            </div>
                            <p className="ml-4 mt-0.5 text-xs text-gray-500">{item.category}</p>
                          </div>
                          <div className="ml-3 flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(item.price)}
                            </span>
                            {inCart ? (
                              <div className="flex items-center gap-1 rounded-lg bg-primary/10">
                                <button
                                  onClick={() => updateQty(item.id, -1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold text-primary">
                                  {inCart.quantity}
                                </span>
                                <button
                                  onClick={() => updateQty(item.id, 1)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/20 transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addToCart(item)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Cart summary + place order */}
              {cart.length > 0 && (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <ShoppingCart className="h-4 w-4" />
                      {cart.reduce((s, c) => s + c.quantity, 0)} items
                    </span>
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(cartTotal)}</span>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50 transition-opacity"
                  >
                    {loading && <Spinner size="sm" className="text-white" />}
                    Place Order
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Counter() {
  const dispatch = useAppDispatch();
  const counterOrders = useAppSelector(selectCounterOrders);
  const menuItems = useAppSelector(selectMenuItems);
  const menuHydrated = useAppSelector(selectMenuHydrated);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [counterResult] = await Promise.all([
        apiClient.listCounterOrdersToday(),
        !menuHydrated
          ? apiClient.listMenuItems().then((items) => dispatch(setMenuItems(items)))
          : Promise.resolve(),
      ]);
      dispatch(setCounterOrders(counterResult.orders));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [dispatch, menuHydrated]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort: pending first, then by created_at desc
  const sorted = [...counterOrders].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  function handleOrderCreated(order: Order) {
    dispatch(upsertCounterOrder(order));
  }

  function handlePaymentSuccess(completedOrder: Order) {
    dispatch(removeCounterOrder(completedOrder.id));
    dispatch(upsertCounterOrder(completedOrder));
    setCheckoutOrder(null);
  }

  return (
    <div className="flex-1 p-6">
      <PageHeader
        title="Counter Orders"
        action={
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Order
          </button>
        }
      />

      {loading && counterOrders.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 px-6 py-4 text-sm text-red-600">
          {error}{' '}
          <button onClick={fetchData} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No counter orders today"
          description="Create a new order to get started."
          action={
            <button
              onClick={() => setPanelOpen(true)}
              className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white"
            >
              New Order
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Ticket #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                    {order.ticket_number !== undefined ? `#${order.ticket_number}` : `#${order.order_number}`}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {order.customer_name ?? <span className="text-gray-400">—</span>}
                    {order.customer_phone && (
                      <span className="ml-1 text-xs text-gray-400">{order.customer_phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        order.service_mode === 'takeaway'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {order.service_mode === 'takeaway' ? 'Takeaway' : 'Eat Here'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => setCheckoutOrder(order)}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        Checkout
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NewOrderPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onCreated={handleOrderCreated}
        menuItems={menuItems}
      />

      <PaymentModal
        order={checkoutOrder}
        open={checkoutOrder !== null}
        onClose={() => setCheckoutOrder(null)}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
