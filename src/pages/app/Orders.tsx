import { useCallback, useEffect, useRef, useState } from 'react';
import {
  UtensilsCrossed,
  Search,
  Plus,
  Minus,
  X,
  ShoppingCart,
  CreditCard,
  Banknote,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectTables, setTables, upsertTable } from '../../store/tablesSlice';
import {
  selectActiveOrders,
  setActiveOrders,
  upsertActiveOrder,
  removeActiveOrder,
} from '../../store/ordersSlice';
import { selectMenuItems, selectMenuCategories, selectMenuHydrated, setMenuItems } from '../../store/menuSlice';
import type { MenuItem } from '../../store/menuSlice';
import type {
  RestaurantTable,
  Order,
  OrderItem,
  CompletePaymentRequest,
  CreateOrderRequest,
} from '../../services/api';
import { apiClient } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { Badge } from '../../components/app/Badge';
import { EmptyState } from '../../components/app/EmptyState';

// ── Helper types ──────────────────────────────────────────────────────────────

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

type PaymentMethod = 'cash' | 'upi';

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function orderStatusVariant(
  status: string
): 'pending' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled' {
  const map: Record<string, 'pending' | 'cooking' | 'ready' | 'served' | 'completed' | 'cancelled'> = {
    pending: 'pending',
    cooking: 'cooking',
    ready: 'ready',
    served: 'served',
    completed: 'completed',
    cancelled: 'cancelled',
  };
  return map[status] ?? 'pending';
}

function resolveItemTotal(item: OrderItem, menuMap: Map<string, MenuItem>): number {
  if (item.total > 0) return item.total;
  const price = item.unit_rate || item.menu_item?.price || menuMap.get(item.menu_id)?.price || 0;
  return price * item.quantity;
}

function getDerivedItemStatus(order: Order): 'ready' | 'cooking' | null {
  const items = order.items ?? [];
  if (items.some((i) => i.status === 'ready')) return 'ready';
  if (items.some((i) => i.status === 'cooking')) return 'cooking';
  return null;
}

// ── Table card ─────────────────────────────────────────────────────────────────

function TableCard({
  table,
  order,
  onClick,
}: {
  table: RestaurantTable;
  order: Order | undefined;
  onClick: () => void;
}) {
  const occupied = table.is_occupied;
  const derived = occupied && order ? getDerivedItemStatus(order) : null;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full flex-col gap-3 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        derived === 'ready'
          ? 'border-green-300 bg-green-50 hover:border-green-400'
          : occupied
          ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
          : 'border-emerald-200 bg-emerald-50 hover:border-emerald-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold text-gray-900">{table.name}</span>
        <Badge variant={occupied ? 'occupied' : 'vacant'}>
          {occupied ? 'In use' : 'Vacant'}
        </Badge>
      </div>

      {occupied && order ? (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">
            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </p>
          <p className="text-sm font-semibold text-gray-900">{fmt(order.total)}</p>
          {derived === 'ready' ? (
            <>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Ready to serve
              </span>
              <p className="text-xs font-medium text-green-600">Tap to serve</p>
            </>
          ) : derived === 'cooking' ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              Cooking…
            </span>
          ) : (
            <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400">Tap to take an order</p>
      )}
    </button>
  );
}

// ── Vacant table panel ────────────────────────────────────────────────────────

function VacantTablePanel({
  table,
  onClose,
  onMarkOccupied,
  onAddItems,
}: {
  table: RestaurantTable;
  onClose: () => void;
  onMarkOccupied: () => Promise<void>;
  onAddItems: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMark = async () => {
    setLoading(true);
    setError(null);
    try {
      await onMarkOccupied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark table as occupied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{table.name}</h2>
            <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Vacant
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 p-6">
          <p className="text-sm text-gray-500">
            This table is currently vacant. Mark it as occupied to reserve it, or add items to start a new order.
          </p>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="space-y-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={handleMark}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Spinner size="sm" className="text-white" /> : null}
            Mark Occupied
          </button>
          <button
            onClick={onAddItems}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add Items
          </button>
        </div>
      </div>
    </>
  );
}

// ── Order Detail panel ────────────────────────────────────────────────────────

function OrderDetailPanel({
  order,
  table,
  onClose,
  onOrderCancelled,
  onOrderCompleted,
  onAddItems,
}: {
  order: Order;
  table: RestaurantTable;
  onClose: () => void;
  onOrderCancelled: (orderId: string) => void;
  onOrderCompleted: (orderId: string, tableId: string) => void;
  onAddItems?: () => void;
}) {
  const dispatch = useAppDispatch();
  const menuItems = useAppSelector(selectMenuItems);
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  // Compute totals from items as fallback when API returns zeros
  const computedSubtotal = order.items.reduce((sum, item) => sum + resolveItemTotal(item, menuMap), 0);
  const displaySubtotal = order.sub_total > 0 ? order.sub_total : computedSubtotal;
  const taxIsFromApi = order.tax_amount > 0;
  const displayTax = taxIsFromApi ? order.tax_amount : parseFloat((displaySubtotal * 0.05).toFixed(2));
  // When tax comes from API, trust the API total. When we computed tax ourselves, always add it to subtotal.
  const displayTotal = taxIsFromApi && order.total > 0 ? order.total : displaySubtotal + displayTax;

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [servingId, setServingId] = useState<string | null>(null);

  const handleServe = async (itemId: string) => {
    setServingId(itemId);
    try {
      const updatedOrder: Order = {
        ...order,
        items: order.items.map((i) => (i.id === itemId ? { ...i, status: 'served' } : i)),
      };
      dispatch(upsertActiveOrder(updatedOrder));
      await apiClient.updateOrderItemStatus(order.id, itemId, 'served');
    } catch (err) {
      console.error('[Orders] mark served failed', err);
    } finally {
      setServingId(null);
    }
  };

  // ── Kitchen status column ─────────────────────────────────────────────────
  const showKitchenStatus = order.items.some(
    (item) => item.status === 'cooking' || item.status === 'ready' || item.status === 'served'
  );

  // ── Discount / payment calculations ──────────────────────────────────────
  const discountValue = parseFloat(discountAmount) || 0;
  const effectiveTotal = Math.max(0, displayTotal - discountValue);
  const changeAmount =
    paymentMethod === 'cash' && amountReceived
      ? Math.max(0, parseFloat(amountReceived) - effectiveTotal)
      : 0;

  const closePaymentModal = () => {
    if (!paymentLoading) {
      setPaymentOpen(false);
      setDiscountAmount('');
      setAmountReceived('');
      setPaymentError(null);
    }
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      await apiClient.startCheckout(order.id);
      setPaymentOpen(true);
    } catch (err: unknown) {
      console.error('[Orders] startCheckout failed', err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePayment = async () => {
    setPaymentError(null);
    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < effectiveTotal) {
        setPaymentError('Amount received must be at least the order total.');
        return;
      }
    }

    const payload: CompletePaymentRequest = {
      payment_method: paymentMethod,
      ...(discountValue > 0 ? { discount_amount: discountValue } : {}),
      ...(paymentMethod === 'cash'
        ? {
            amount_received: parseFloat(amountReceived),
            change_returned: changeAmount,
          }
        : {}),
    };

    setPaymentLoading(true);
    try {
      await apiClient.completeOrderWithPayment(order.id, payload);
      const updatedTable = await apiClient.setTableVacant(table.id);
      dispatch(upsertTable(updatedTable));
      dispatch(removeActiveOrder(order.id));
      onOrderCompleted(order.id, table.id);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelError(null);
    setCancelLoading(true);
    try {
      await apiClient.cancelOrder(order.id);
      const updatedTable = await apiClient.setTableVacant(table.id);
      dispatch(upsertTable(updatedTable));
      dispatch(removeActiveOrder(order.id));
      onOrderCancelled(order.id);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{table.name}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs text-gray-500">Order #{order.order_number}</span>
              <Badge variant={orderStatusVariant(order.status)}>{order.status}</Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-400">
                <th className="pb-2">Item</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Total</th>
                {showKitchenStatus && <th className="pb-2 text-right">Status</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-gray-900">
                    {item.menu_item?.name ?? menuMap.get(item.menu_id)?.name ?? 'Item'}
                  </td>
                  <td className="py-2.5 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900">
                    {fmt(resolveItemTotal(item, menuMap))}
                  </td>
                  {showKitchenStatus && (
                    <td className="py-2.5 text-right">
                      {item.status === 'ready' ? (
                        <button
                          onClick={() => handleServe(item.id)}
                          disabled={servingId === item.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {servingId === item.id ? (
                            <Spinner size="sm" className="text-white" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Serve
                        </button>
                      ) : (
                        <Badge variant={orderStatusVariant(item.status)}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span>{fmt(displaySubtotal)}</span>
          </div>
          {displayTax > 0 && (
            <div className="flex justify-between text-sm text-gray-500">
              <span>Tax (5%)</span>
              <span>{fmt(displayTax)}</span>
            </div>
          )}
          {order.discount_amount && order.discount_amount > 0 ? (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{fmt(order.discount_amount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
            <span>Total</span>
            <span>{fmt(displayTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Checkout
              </button>

              {onAddItems && (
                <button
                  onClick={onAddItems}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  Add items
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setCancelConfirmOpen(true)}
            disabled={cancelLoading || order.status === 'completed' || order.status === 'cancelled'}
            className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            Cancel order
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={paymentOpen} onClose={closePaymentModal} title="Payment" maxWidth="sm">
        <div className="space-y-5">
          {paymentError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {paymentError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                paymentMethod === 'cash'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Banknote className="h-4 w-4" />
              Cash
            </button>
            <button
              onClick={() => setPaymentMethod('upi')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                paymentMethod === 'upi'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              UPI
            </button>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Order total</p>
            <p className="text-2xl font-bold text-gray-900">{fmt(displayTotal)}</p>
          </div>

          {/* Discount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Discount (optional)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
              <input
                type="number"
                min={0}
                max={displayTotal}
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {discountValue > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                Updated total:{' '}
                <span className="font-semibold text-gray-900">{fmt(effectiveTotal)}</span>
              </p>
            )}
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Amount received (₹)
                </label>
                <input
                  type="number"
                  min={effectiveTotal}
                  step="0.01"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder={String(effectiveTotal)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {amountReceived && !isNaN(parseFloat(amountReceived)) && changeAmount >= 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-emerald-600">Change to return</p>
                  <p className="text-lg font-bold text-emerald-700">{fmt(changeAmount)}</p>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'upi' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Confirm once UPI payment is received from the customer.
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={closePaymentModal}
              disabled={paymentLoading}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              disabled={paymentLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {paymentLoading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirm payment
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel confirm modal */}
      <Modal
        open={cancelConfirmOpen}
        onClose={() => !cancelLoading && setCancelConfirmOpen(false)}
        title="Cancel order?"
        maxWidth="sm"
      >
        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to cancel order{' '}
          <span className="font-semibold text-gray-900">#{order.order_number}</span> for{' '}
          <span className="font-semibold text-gray-900">{table.name}</span>?
        </p>
        {cancelError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cancelError}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setCancelConfirmOpen(false)}
            disabled={cancelLoading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Go back
          </button>
          <button
            onClick={handleCancel}
            disabled={cancelLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {cancelLoading && <Spinner size="sm" className="text-white" />}
            Cancel order
          </button>
        </div>
      </Modal>
    </>
  );
}

// ── Take Order panel ──────────────────────────────────────────────────────────

function TakeOrderPanel({
  table,
  onClose,
  onOrderPlaced,
  existingOrder,
}: {
  table: RestaurantTable;
  onClose: () => void;
  onOrderPlaced: (order: Order, table: RestaurantTable) => void;
  existingOrder?: Order;
}) {
  const dispatch = useAppDispatch();
  const menuItems = useAppSelector(selectMenuItems);
  const menuCategories = useAppSelector(selectMenuCategories);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const visibleItems = menuItems.filter((item) => {
    if (!item.is_available) return false;
    const matchesSearch =
      search.trim() === '' ||
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlaceError(null);
    setPlacing(true);

    try {
      if (existingOrder) {
        // Add-items mode: append to existing order
        const updatedOrder = await apiClient.addItemsToOrder(
          existingOrder.id,
          cart.map((c) => ({ menu_item_id: c.menuItem.id, quantity: c.quantity }))
        );
        dispatch(upsertActiveOrder(updatedOrder));
        onOrderPlaced(updatedOrder, table);
      } else {
        // New order mode
        const orderData: CreateOrderRequest = {
          table_id: table.id,
          table_number: table.name,
          order_type: 'dine_in',
          customer_name: customerName.trim() || undefined,
          items: cart.map((c) => ({ menu_item_id: c.menuItem.id, quantity: c.quantity })),
        };
        const newOrder = await apiClient.createOrder(orderData);
        const updatedTable = await apiClient.setTableOccupied(table.id, newOrder.id);
        dispatch(upsertActiveOrder(newOrder));
        dispatch(upsertTable(updatedTable));
        onOrderPlaced(newOrder, updatedTable);
      }
    } catch (err: unknown) {
      setPlaceError(
        err instanceof Error
          ? err.message
          : existingOrder
          ? 'Failed to add items'
          : 'Failed to place order'
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {existingOrder ? `Add Items — ${table.name}` : `New Order — ${table.name}`}
            </h2>
            <p className="text-xs text-gray-400">{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — menu browser */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-gray-100">
            {/* Search */}
            <div className="px-4 pt-4 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search menu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-1">
              {['All', ...menuCategories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {visibleItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No items found</p>
              ) : (
                <div className="space-y-1.5">
                  {visibleItems.map((item) => {
                    const inCart = cart.find((c) => c.menuItem.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.category}</p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-gray-800">
                            ₹{item.price}
                          </span>
                          {inCart ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                              {inCart.quantity}
                            </span>
                          ) : (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary text-primary">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — cart */}
          <div className="flex w-72 shrink-0 flex-col">
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ShoppingCart className="h-4 w-4" />
                  Items in Order
                </div>
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">
                    Add items from the menu
                  </p>
                ) : (
                  cart.map((c) => (
                    <div
                      key={c.menuItem.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-900">
                          {c.menuItem.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          ₹{c.menuItem.price} × {c.quantity}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => updateQty(c.menuItem.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold text-gray-800">
                          {c.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(c.menuItem.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-primary/10 hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer name — only for new orders */}
              {!existingOrder && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <input
                    type="text"
                    placeholder="Customer name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {/* Total + place / add order */}
            <div className="border-t border-gray-100 px-4 py-4 space-y-3">
              {placeError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {placeError}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Total Amount:</span>
                <span>{fmt(cartTotal)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || placing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {placing ? (
                  <Spinner size="sm" className="text-white" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Save Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function Orders() {
  const dispatch = useAppDispatch();
  const tables = useAppSelector(selectTables);
  const activeOrders = useAppSelector(selectActiveOrders);

  const menuHydrated = useAppSelector(selectMenuHydrated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected table / panel
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [panelMode, setPanelMode] = useState<'detail' | 'vacant' | 'take-order' | 'add-items' | null>(null);

  // Load tables, orders, and menu on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetches: Promise<unknown>[] = [
      apiClient.getTables(),
      apiClient.listOrdersSummary('active'),
    ];
    if (!menuHydrated) {
      fetches.push(apiClient.listMenuItems());
    }

    Promise.all(fetches)
      .then(([tablesData, ordersData, menuData]) => {
        if (cancelled) return;
        const tables = tablesData as RestaurantTable[];
        const orders = (ordersData as { orders: Order[] }).orders;

        // Reconcile: if the API returns a table as vacant but an active order
        // references it, upgrade it to occupied. Never downgrade an occupied
        // table — trust the server's is_occupied flag for that direction.
        const reconciledTables = tables.map((t) => {
          if (t.is_occupied) return t; // already correct per server
          const matchingOrder = orders.find(
            (o) => o.table_id === t.id || o.id === t.current_order_id
          );
          if (matchingOrder) {
            return { ...t, is_occupied: true, current_order_id: matchingOrder.id };
          }
          return t;
        });

        dispatch(setTables(reconciledTables));
        dispatch(setActiveOrders(orders));
        if (menuData) dispatch(setMenuItems(menuData as MenuItem[]));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers
  const getOrderForTable = useCallback(
    (table: RestaurantTable): Order | undefined =>
      activeOrders.find((o) => o.id === table.current_order_id),
    [activeOrders]
  );

  const occupiedCount = tables.filter((t) => t.is_occupied).length;

  const handleTableClick = (table: RestaurantTable) => {
    setSelectedTable(table);
    setPanelMode(table.is_occupied ? 'detail' : 'vacant');
  };

  const closePanel = useCallback(() => {
    setSelectedTable(null);
    setPanelMode(null);
  }, []);

  const handleOrderCancelled = useCallback(() => {
    closePanel();
  }, [closePanel]);

  const handleOrderCompleted = useCallback(() => {
    closePanel();
  }, [closePanel]);

  const handleOrderPlaced = useCallback(() => {
    closePanel();
  }, [closePanel]);

  // When "Add items" TakeOrderPanel closes or submits — return to detail view
  const handleAddItemsDone = useCallback(() => {
    setPanelMode('detail');
  }, []);

  const handleMarkOccupied = useCallback(async () => {
    if (!selectedTable) return;
    // Create an empty order to hold the table, matching mobile's handleMarkOccupied
    const newOrder = await apiClient.createOrder({
      order_type: 'dine_in',
      table_number: selectedTable.name,
      table_id: selectedTable.id,
      items: [],
    });
    const updatedTable = await apiClient.setTableOccupied(selectedTable.id, newOrder.id);
    dispatch(upsertActiveOrder(newOrder));
    dispatch(upsertTable(updatedTable));
    // Update local selection so getOrderForTable resolves correctly
    setSelectedTable(updatedTable);
    setPanelMode('detail');
  }, [selectedTable, dispatch]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Restaurant Tables"
        subtitle={`${occupiedCount} of ${tables.length} table${tables.length !== 1 ? 's' : ''} occupied`}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No tables configured"
          description="Add tables in Settings to start taking dine-in orders."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              order={getOrderForTable(table)}
              onClick={() => handleTableClick(table)}
            />
          ))}
        </div>
      )}

      {/* Vacant table slide-over */}
      {selectedTable && panelMode === 'vacant' && (
        <VacantTablePanel
          table={selectedTable}
          onClose={closePanel}
          onMarkOccupied={handleMarkOccupied}
          onAddItems={() => setPanelMode('take-order')}
        />
      )}

      {/* Order detail slide-over */}
      {selectedTable && panelMode === 'detail' && (() => {
        const order = getOrderForTable(selectedTable);
        if (!order) return null;
        return (
          <OrderDetailPanel
            order={order}
            table={selectedTable}
            onClose={closePanel}
            onOrderCancelled={handleOrderCancelled}
            onOrderCompleted={handleOrderCompleted}
            onAddItems={() => setPanelMode('add-items')}
          />
        );
      })()}

      {/* Take order slide-over */}
      {selectedTable && panelMode === 'take-order' && (
        <TakeOrderPanel
          table={selectedTable}
          onClose={closePanel}
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      {/* Add items slide-over */}
      {selectedTable && panelMode === 'add-items' && (() => {
        const order = getOrderForTable(selectedTable);
        if (!order) return null;
        return (
          <TakeOrderPanel
            table={selectedTable}
            onClose={handleAddItemsDone}
            onOrderPlaced={handleAddItemsDone}
            existingOrder={order}
          />
        );
      })()}
    </div>
  );
}
