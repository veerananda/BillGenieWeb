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
  ArrowLeftRight,
  QrCode,
  Printer,
  Clock,
  Leaf,
  Beef,
} from 'lucide-react';
import { calculateOrderTax } from '../../lib/orderTax';
import { buildCustomerBillFromOrder, printBillHtml } from '../../lib/customerBillFormat';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole, selectCanCancelOrders } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
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
import { BillShareQrModal } from '../../components/app/BillShareQrModal';
import { Badge } from '../../components/app/Badge';
import { EmptyState } from '../../components/app/EmptyState';

// ── Helper types ──────────────────────────────────────────────────────────────

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

type PaymentMethod = 'cash' | 'upi' | 'split';

// ── Small helpers ─────────────────────────────────────────────────────────────


function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function billSubtotal(order: Order): number {
  const fromItems = (order.items ?? []).reduce((sum, item) => {
    if (item.total > 0) return sum + item.total;
    return sum + (item.unit_rate || 0) * item.quantity;
  }, 0);
  if (fromItems > 0) return fromItems;
  return order.sub_total > 0 ? order.sub_total : order.total;
}

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

  const readyCount = order?.items?.filter((i) => i.status === 'ready').length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        derived === 'ready'
          ? 'border-amber-400 bg-amber-50 hover:border-amber-500'
          : occupied
          ? 'border-red-400 bg-red-50 hover:border-red-500'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {/* Badge row */}
      <div className="flex items-start justify-between gap-2">
        <Badge variant={derived === 'ready' ? 'warning' : occupied ? 'occupied' : 'vacant'}>
          <span className="flex items-center gap-1">
            {derived === 'ready' && <CheckCircle className="h-3 w-3" />}
            {derived === 'ready' ? 'Ready to serve' : occupied ? 'In use' : 'Vacant'}
          </span>
        </Badge>
      </div>

      {/* Table name */}
      <span className="text-base font-bold text-gray-900">
        {table.name}{table.capacity ? ` (${table.capacity})` : ''}
      </span>

      {/* Content */}
      {occupied && order ? (
        <div className="space-y-1">
          {derived === 'ready' ? (
            <>
              <p className="text-xs font-bold text-red-600">
                {readyCount} {readyCount === 1 ? 'item' : 'items'} ready to serve
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                {(order.items?.length ?? 0) > 0
                  ? (() => { const qty = (order.items ?? []).reduce((s, i) => s + i.quantity, 0); return `${qty} Item${qty !== 1 ? 's' : ''}`; })()
                  : 'No items yet'}
              </p>
              {(order.items?.length ?? 0) > 0 && (
                <p className="text-sm font-semibold text-primary">{fmt(billSubtotal(order))}</p>
              )}
              {derived === 'cooking' && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Cooking…
                </span>
              )}
            </>
          )}
        </div>
      ) : occupied ? (
        <p className="text-xs text-gray-500">Occupied</p>
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
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Table - {table.name}</h2>
            <Badge variant="vacant">Vacant</Badge>
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
  canCancel,
}: {
  order: Order;
  table: RestaurantTable;
  onClose: () => void;
  onOrderCancelled: (orderId: string) => void;
  onOrderCompleted: (orderId: string, tableId: string) => void;
  onAddItems?: () => void;
  canCancel: boolean;
}) {
  const dispatch = useAppDispatch();
  const menuItems = useAppSelector(selectMenuItems);
  const profile = useAppSelector(selectProfile);
  const menuMap = new Map(menuItems.map((m) => [m.id, m]));

  // Hydrate full order (with items) when the panel opens or items are missing
  useEffect(() => {
    if (!order.items?.length) {
      apiClient.getOrder(order.id)
        .then((full) => dispatch(upsertActiveOrder(full)))
        .catch(() => {});
    }
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute totals — use GST setting from profile
  const pricesIncludeGst = profile?.prices_include_gst ?? false;
  const computedSubtotal = (order.items ?? []).reduce((sum, item) => sum + resolveItemTotal(item, menuMap), 0);
  // When prices include GST: gross = item prices as shown on menu (already GST-inclusive).
  // order.sub_total from the API is the pre-tax base (backend already extracted GST), so using it
  // here would double-extract GST. Always use computedSubtotal when prices include GST.
  // When prices exclude GST: gross = pre-tax amount (API sub_total or computed fallback).
  const gross = pricesIncludeGst
    ? (computedSubtotal > 0 ? computedSubtotal : order.sub_total)
    : (order.sub_total > 0 ? order.sub_total : computedSubtotal);

  const [customerNameDraft, setCustomerNameDraft] = useState(order.customer_name ?? '');
  const [savingName, setSavingName] = useState(false);

  const handleSaveCustomerName = async () => {
    const trimmed = customerNameDraft.trim();
    if (trimmed === (order.customer_name ?? '')) return;
    setSavingName(true);
    try {
      const updated = await apiClient.updateOrder(order.id, { customer_name: trimmed || undefined });
      dispatch(upsertActiveOrder(updated));
    } catch {
      // silent — non-critical
    } finally {
      setSavingName(false);
    }
  };

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [checkoutAcquired, setCheckoutAcquired] = useState(false);
  const [checkoutConflictMsg, setCheckoutConflictMsg] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState<'₹' | '%'>('₹');
  const [upiTransactionId, setUpiTransactionId] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [billShareOpen, setBillShareOpen] = useState(false);
  const [billShareUrl, setBillShareUrl] = useState<string | null>(null);
  const [billShareLoading, setBillShareLoading] = useState(false);

  // Split bill state
  const [splitPhase, setSplitPhase] = useState<'cash' | 'upi'>('cash');
  const [splitCashPortion, setSplitCashPortion] = useState('');
  const [splitCashGiven, setSplitCashGiven] = useState('');

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [servingId, setServingId] = useState<string | null>(null);

  const handleServe = async (itemId: string) => {
    setServingId(itemId);
    try {
      const updatedOrder: Order = {
        ...order,
        items: (order.items ?? []).map((i) => (i.id === itemId ? { ...i, status: 'served' } : i)),
      };
      dispatch(upsertActiveOrder(updatedOrder));
      await apiClient.updateOrderItemStatus(order.id, itemId, 'served');
    } catch (err) {
      console.error('[Orders] mark served failed', err);
    } finally {
      setServingId(null);
    }
  };

  // ── Group duplicate menu items by menu_id ────────────────────────────────
  const STATUS_RANK: Record<string, number> = { pending: 0, cooking: 1, ready: 2, served: 3 };
  const groupedItems = Object.values(
    (order.items ?? []).reduce<
      Record<string, { menuId: string; name: string; quantity: number; total: number; status: string; ids: string[] }>
    >((acc, item) => {
      const key = item.menu_id;
      const name = item.menu_item?.name ?? menuMap.get(item.menu_id)?.name ?? 'Item';
      const itemTotal = resolveItemTotal(item, menuMap);
      if (acc[key]) {
        acc[key].quantity += item.quantity;
        acc[key].total += itemTotal;
        acc[key].ids.push(item.id);
        // Show the least-advanced status so we don't hide pending work
        if ((STATUS_RANK[item.status] ?? 0) < (STATUS_RANK[acc[key].status] ?? 0)) {
          acc[key].status = item.status;
        }
      } else {
        acc[key] = { menuId: key, name, quantity: item.quantity, total: itemTotal, status: item.status, ids: [item.id] };
      }
      return acc;
    }, {})
  );

  // ── GST-aware totals ──────────────────────────────────────────────────────
  const discountInput = parseFloat(discountAmount) || 0;
  const discountValue = discountType === '%'
    ? Math.min(gross, gross * discountInput / 100)
    : discountInput;
  const taxResult = calculateOrderTax(gross, discountValue, pricesIncludeGst);
  const displaySubtotal = taxResult.subtotal;
  const displayTax = taxResult.taxAmount;
  const displayTotal = taxResult.finalAmount;
  const effectiveTotal = displayTotal;

  const changeAmount =
    paymentMethod === 'cash' && amountReceived
      ? Math.max(0, parseFloat(amountReceived) - effectiveTotal)
      : 0;

  // Split bill derived values
  const splitCashPortionAmount = parseFloat(splitCashPortion) || 0;
  const splitUpiAmount = Math.max(0, effectiveTotal - splitCashPortionAmount);
  const splitCashGivenAmount = parseFloat(splitCashGiven) || 0;
  const splitChange = Math.max(0, splitCashGivenAmount - splitCashPortionAmount);
  const isSplitCashValid =
    splitCashPortionAmount > 0 && splitUpiAmount > 0.01 && splitCashGivenAmount >= splitCashPortionAmount;

  const closePaymentModal = () => {
    if (!paymentLoading) {
      if (checkoutAcquired) {
        apiClient.cancelCheckout(order.id);
      }
      setPaymentOpen(false);
      setCheckoutAcquired(false);
      setDiscountAmount('');
      setDiscountType('₹');
      setAmountReceived('');
      setUpiTransactionId('');
      setPaymentError(null);
      setSplitPhase('cash');
      setSplitCashPortion('');
      setSplitCashGiven('');
    }
  };

  const handleCheckout = () => {
    setPaymentOpen(true);
    setPaymentError(null);
    setCheckoutConflictMsg(null);
    setCheckoutAcquired(false);
    apiClient.startCheckout(order.id)
      .then(() => setCheckoutAcquired(true))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message.toLowerCase() : '';
        if (msg.includes('no longer active')) {
          setPaymentOpen(false);
          onOrderCompleted(order.id, table.id);
          return;
        }
        if (msg.includes('checkout already in progress')) {
          // Close modal, show error in the drawer so another device can proceed
          setPaymentOpen(false);
          setCheckoutConflictMsg('Checkout is already in progress on another device. Please wait.');
          return;
        }
        setPaymentError(err instanceof Error ? err.message : 'Could not start checkout');
      });
  };

  const handleOpenBillShare = async () => {
    setBillShareOpen(true);
    setBillShareLoading(true);
    setBillShareUrl(null);
    try {
      const response = await apiClient.createBillShare(order.id, discountValue);
      setBillShareUrl(response.bill_url);
    } catch (err: unknown) {
      setBillShareOpen(false);
      setPaymentError(err instanceof Error ? err.message : 'Could not create customer bill link');
    } finally {
      setBillShareLoading(false);
    }
  };

  const handlePrintBill = () => {
    const html = buildCustomerBillFromOrder(
      order,
      profile,
      {
        subtotal: displaySubtotal,
        taxAmount: displayTax,
        discountValue: discountValue || order.discount_amount || 0,
        finalAmount: displayTotal,
        pricesIncludeGst,
      },
      groupedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        total: item.total,
      })),
    );
    printBillHtml(html);
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
    if (paymentMethod === 'split' && splitPhase === 'cash') {
      if (!isSplitCashValid) {
        setPaymentError('Enter valid cash portion and cash received.');
        return;
      }
      setSplitPhase('upi');
      setPaymentError(null);
      return;
    }

    let payload: CompletePaymentRequest;
    if (paymentMethod === 'split') {
      payload = {
        payment_method: 'split',
        cash_amount: splitCashPortionAmount,
        upi_amount: splitUpiAmount,
        amount_received: splitCashGivenAmount,
        change_returned: splitChange,
        ...(upiTransactionId.trim() ? { upi_transaction_id: upiTransactionId.trim() } : {}),
        ...(discountValue > 0 ? { discount_amount: discountValue } : {}),
      };
    } else {
      payload = {
        payment_method: paymentMethod,
        amount_received: paymentMethod === 'cash' ? parseFloat(amountReceived) : effectiveTotal,
        change_returned: paymentMethod === 'cash' ? changeAmount : 0,
        ...(discountValue > 0 ? { discount_amount: discountValue } : {}),
        ...(paymentMethod === 'upi' && upiTransactionId.trim()
          ? { upi_transaction_id: upiTransactionId.trim() }
          : {}),
      };
    }

    setPaymentLoading(true);
    try {
      await apiClient.completeOrderWithPayment(order.id, payload);
      const updatedTable = await apiClient.setTableVacant(table.id);
      dispatch(upsertTable(updatedTable));
      dispatch(removeActiveOrder(order.id));
      setCheckoutAcquired(false);
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Table - {table.name}</h2>
              <Badge variant={table.is_occupied ? 'occupied' : 'vacant'}>
                {table.is_occupied ? 'In use' : 'Vacant'}
              </Badge>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Customer name — editable */}
        <div className="border-b border-gray-100 px-6 py-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Customer</p>
          <input
            type="text"
            value={customerNameDraft}
            onChange={(e) => setCustomerNameDraft(e.target.value)}
            onBlur={handleSaveCustomerName}
            disabled={savingName}
            placeholder="Add customer name (optional)"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
          />
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
            Items ({groupedItems.length})
          </p>
          <div className="space-y-3">
            {groupedItems.map((item) => {
              const unitPrice = item.quantity > 0 ? item.total / item.quantity : 0;
              const isReady = item.status === 'ready';
              const isCooking = item.status === 'cooking';
              const isServed = item.status === 'served';
              const isServing = item.ids.some((id) => servingId === id);
              return (
                <div key={item.menuId} className="flex items-center gap-3">
                  {/* Status icon — tappable when ready */}
                  {isReady ? (
                    <button
                      onClick={() => item.ids.forEach((id) => handleServe(id))}
                      disabled={isServing}
                      title="Tap to mark as served"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 transition-all hover:bg-primary/20 disabled:opacity-50 active:scale-95"
                    >
                      {isServing
                        ? <CheckCircle className="h-5 w-5 text-primary" />
                        : <UtensilsCrossed className="h-5 w-5 text-primary" />}
                    </button>
                  ) : isServed ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                  ) : (
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isCooking ? 'bg-amber-50' : 'bg-gray-100'}`}>
                      <Clock className={`h-5 w-5 ${isCooking ? 'text-amber-500' : 'text-gray-400'}`} />
                    </div>
                  )}

                  {/* Name + qty */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity}× {fmt(unitPrice)}</p>
                  </div>

                  {/* Total + status label */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-gray-900">{fmt(item.total)}</span>
                    {isReady ? (
                      <span className="text-xs font-medium text-primary">Tap to serve</span>
                    ) : isCooking ? (
                      <Badge variant="cooking">Cooking</Badge>
                    ) : isServed ? (
                      <Badge variant="served">Served</Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-1.5">
          {order.discount_amount && order.discount_amount > 0 ? (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{fmt(order.discount_amount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-bold text-gray-900">
            <span>Total</span>
            <span>{fmt(displayTotal)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          {checkoutConflictMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              {checkoutConflictMsg}
            </div>
          )}
          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <>
              {onAddItems && (
                <button
                  onClick={onAddItems}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                >
                  <Plus className="h-4 w-4" />
                  Add items
                </button>
              )}

              <div className="flex gap-3">
                {canCancel && (
                  <button
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={cancelLoading || order.status === 'completed' || order.status === 'cancelled'}
                    className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    Cancel order
                  </button>
                )}
                <button
                  onClick={() => { setCheckoutConflictMsg(null); handleCheckout(); }}
                  className={`flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 ${canCancel ? 'flex-1' : 'w-full'}`}
                >
                  <CreditCard className="h-4 w-4" />
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal
        open={paymentOpen}
        onClose={closePaymentModal}
        title="Bill Summary"
        maxWidth="3xl"
      >
        <div className="flex gap-6">
          {/* ── Left column: bill items + subtotal + GST ── */}
          <div className="w-64 shrink-0">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Bill Summary</p>
              <div className="space-y-1.5">
                {groupedItems.map((item) => (
                  <div key={item.menuId} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name} ×{item.quantity}</span>
                    <span className="font-medium text-gray-900">{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-2 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{fmt(displaySubtotal)}</span>
                </div>
                {displayTax > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>GST (5%)</span>
                    <span>{fmt(displayTax)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: discount + customer review + payment method ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {paymentError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {paymentError}
              </div>
            )}

            {/* Apply Discount card */}
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 space-y-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">Apply Discount (Optional)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={discountType === '%' ? 100 : gross}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => { setDiscountType('₹'); setDiscountAmount(''); }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    discountType === '₹'
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ₹
                </button>
                <button
                  onClick={() => { setDiscountType('%'); setDiscountAmount(''); }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    discountType === '%'
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  %
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">Total Amount</span>
                <span className="text-lg font-bold text-primary">{fmt(displayTotal)}</span>
              </div>
            </div>

            {/* Customer review card */}
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 space-y-2 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">Customer review</p>
              <p className="text-xs text-gray-400">Share the bill for the customer to verify and download before you collect payment.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleOpenBillShare}
                  disabled={billShareLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  {billShareLoading ? <Spinner size="sm" /> : <QrCode className="h-4 w-4" />}
                  Customer bill QR
                </button>
                <button
                  type="button"
                  onClick={handlePrintBill}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Printer className="h-4 w-4" />
                  Print bill
                </button>
              </div>
            </div>

            {/* Payment Method card */}
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 space-y-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">Payment Method</p>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {([
                    { value: 'cash' as PaymentMethod, label: 'Pay by Cash', icon: <Banknote className="h-4 w-4" /> },
                    { value: 'upi' as PaymentMethod, label: 'Pay by UPI', icon: <CreditCard className="h-4 w-4" /> },
                  ] as const).map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => { setPaymentMethod(tab.value); setSplitPhase('cash'); setPaymentError(null); }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                        paymentMethod === tab.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setPaymentMethod('split'); setSplitPhase('cash'); setPaymentError(null); }}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                    paymentMethod === 'split'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Split payment
                </button>
              </div>

              {/* ── UPI inputs ── */}
              {paymentMethod === 'upi' && (
                <div className="space-y-3 pt-1">
                  {profile?.upi_qr_code ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-3">
                      <img src={profile.upi_qr_code} alt="UPI QR Code" className="h-36 w-36 rounded-lg object-contain" />
                      {profile.upi_id && <p className="text-xs font-medium text-gray-600">{profile.upi_id}</p>}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-center text-xs text-gray-400">
                      Add a UPI ID in Restaurant Profile to enable dynamic payment QR codes.
                    </div>
                  )}
                  <div className="rounded-xl bg-gray-50 px-4 py-3 text-center">
                    <p className="mb-0.5 text-xs font-medium text-gray-500">Bill Amount</p>
                    <p className="text-xl font-bold text-primary">{fmt(displayTotal)}</p>
                  </div>
                  <input
                    type="text"
                    value={upiTransactionId}
                    onChange={(e) => setUpiTransactionId(e.target.value)}
                    placeholder="Enter transaction ID after payment (optional)"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* ── Cash inputs ── */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Amount received (₹)</label>
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
                  {amountReceived && !isNaN(parseFloat(amountReceived)) && (
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
                      <span className="text-gray-600">Change to Return</span>
                      <span className={`font-semibold ${changeAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {fmt(Math.max(0, changeAmount))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Split cash phase ── */}
              {paymentMethod === 'split' && splitPhase === 'cash' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Cash portion</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                      <input
                        type="number"
                        min={0}
                        max={effectiveTotal}
                        step="0.01"
                        value={splitCashPortion}
                        onChange={(e) => setSplitCashPortion(e.target.value)}
                        placeholder="0"
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {splitCashPortionAmount > 0 && (
                      <p className="mt-1 text-xs text-gray-500">UPI remainder: <span className="font-semibold text-primary">{fmt(splitUpiAmount)}</span></p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Cash received</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                      <input
                        type="number"
                        min={splitCashPortionAmount}
                        step="0.01"
                        value={splitCashGiven}
                        onChange={(e) => setSplitCashGiven(e.target.value)}
                        placeholder={String(splitCashPortionAmount || 0)}
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {splitCashGivenAmount > 0 && splitCashPortionAmount > 0 && (
                      <p className="mt-1 text-xs text-gray-500">Change to return: <span className="font-semibold">{fmt(splitChange)}</span></p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Split UPI phase ── */}
              {paymentMethod === 'split' && splitPhase === 'upi' && (
                <div className="space-y-3 pt-1">
                  {profile?.upi_qr_code ? (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-3">
                      <img src={profile.upi_qr_code} alt="UPI QR" className="h-32 w-32 rounded-lg object-contain" />
                      {profile.upi_id && <p className="text-xs font-medium text-gray-600">{profile.upi_id}</p>}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-center text-xs text-gray-400">
                      Add a UPI ID in Restaurant Profile to enable QR codes.
                    </div>
                  )}
                  <div className="rounded-xl bg-gray-50 px-4 py-3 text-center">
                    <p className="mb-0.5 text-xs font-medium text-gray-500">UPI Amount</p>
                    <p className="text-xl font-bold text-primary">{fmt(splitUpiAmount)}</p>
                    <p className="mt-0.5 text-xs text-gray-400">Cash paid: {fmt(splitCashPortionAmount)}</p>
                  </div>
                  <input
                    type="text"
                    value={upiTransactionId}
                    onChange={(e) => setUpiTransactionId(e.target.value)}
                    placeholder="Enter UPI transaction ID (optional)"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={paymentMethod === 'split' && splitPhase === 'upi' ? () => setSplitPhase('cash') : closePaymentModal}
                disabled={paymentLoading}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handlePayment}
                disabled={paymentLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {paymentLoading ? <Spinner size="sm" className="text-white" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
                <span className="text-center leading-tight">
                  {paymentMethod === 'split' && splitPhase === 'cash' ? <>Accept Cash<br />&amp; Pay UPI</> : 'Confirm Payment'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <BillShareQrModal
        open={billShareOpen}
        billUrl={billShareUrl}
        loading={billShareLoading}
        onClose={() => setBillShareOpen(false)}
      />

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
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non_veg'>('all');
  const [activeCategory, setActiveCategory] = useState<string>(() => menuCategories[0] ?? '');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // If categories load after mount, default to first
  useEffect(() => {
    if (menuCategories.length > 0 && !activeCategory) {
      setActiveCategory(menuCategories[0]);
    }
  }, [menuCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // Count per category respecting diet filter (not search)
  const categoryCount = (cat: string) =>
    menuItems.filter((m) => {
      if (!m.is_available || m.category !== cat) return false;
      if (dietFilter === 'veg' && !m.is_veg) return false;
      if (dietFilter === 'non_veg' && m.is_veg) return false;
      return true;
    }).length;

  // When searching, span all categories; otherwise filter by activeCategory
  const visibleItems = menuItems.filter((m) => {
    if (!m.is_available) return false;
    if (dietFilter === 'veg' && !m.is_veg) return false;
    if (dietFilter === 'non_veg' && m.is_veg) return false;
    if (search.trim()) return m.name.toLowerCase().includes(search.toLowerCase());
    return m.category === activeCategory;
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
        .map((c) => (c.menuItem.id === itemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setPlaceError(null);
    setPlacing(true);
    try {
      if (existingOrder) {
        const updatedOrder = await apiClient.addItemsToOrder(
          existingOrder.id,
          cart.map((c) => ({ menu_item_id: c.menuItem.id, quantity: c.quantity }))
        );
        dispatch(upsertActiveOrder(updatedOrder));
        onOrderPlaced(updatedOrder, table);
      } else {
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
        err instanceof Error ? err.message : existingOrder ? 'Failed to add items' : 'Failed to place order'
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Table - {table.name}</h2>
            <Badge variant={table.is_occupied ? 'occupied' : 'vacant'}>
              {table.is_occupied ? 'In use' : 'Vacant'}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — search + diet filter + category list */}
          <div className="flex w-64 shrink-0 flex-col border-r border-gray-100">
            <div className="space-y-2 border-b border-gray-100 p-3">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {/* Diet filter */}
              <div className="flex gap-1">
                {(
                  [
                    { value: 'all', label: 'All', icon: null },
                    { value: 'veg', label: 'Veg', icon: <Leaf size={13} color={dietFilter === 'veg' ? '#ffffff' : '#22c55e'} /> },
                    { value: 'non_veg', label: 'Non-Veg', icon: <Beef size={13} color={dietFilter === 'non_veg' ? '#ffffff' : '#dc2626'} /> },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDietFilter(f.value)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                      dietFilter === f.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.icon}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto">
              {menuCategories.map((cat) => {
                const count = categoryCount(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setSearch(''); }}
                    className={`flex w-full items-center justify-between border-b border-gray-50 px-4 py-3 text-left text-sm transition-colors ${
                      activeCategory === cat && !search.trim()
                        ? 'border-l-2 border-l-primary bg-primary/10 font-semibold text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className={`ml-2 shrink-0 text-xs ${activeCategory === cat && !search.trim() ? 'text-primary' : 'text-gray-400'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Middle — items */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {search.trim() ? `Results for "${search}"` : activeCategory}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0">
                              {item.is_veg
                                ? <Leaf size={14} color="#22c55e" />
                                : <Beef size={14} color="#dc2626" />}
                            </span>
                            <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                          </div>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-3">
                          <span className="text-sm font-semibold text-gray-800">₹{item.price}</span>
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
          <div className="flex w-60 shrink-0 flex-col border-l border-gray-100">
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ShoppingCart className="h-4 w-4" />
                  Items in Order
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">Add items from the menu</p>
                ) : (
                  cart.map((c) => (
                    <div
                      key={c.menuItem.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-900">{c.menuItem.name}</p>
                        <p className="text-xs text-gray-400">₹{c.menuItem.price} × {c.quantity}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => updateQty(c.menuItem.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold text-gray-800">{c.quantity}</span>
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

              {!existingOrder && (
                <div className="border-t border-gray-100 px-3 py-3">
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

            <div className="border-t border-gray-100 px-3 py-4 space-y-3">
              {placeError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {placeError}
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Total:</span>
                <span>{fmt(cartTotal)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || placing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {placing ? <Spinner size="sm" className="text-white" /> : <CheckCircle className="h-4 w-4" />}
                {existingOrder ? 'Save New Items' : 'Save Order'}
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
  const role = useAppSelector(selectAuthRole);
  const canCancelOrders = useAppSelector(selectCanCancelOrders);
  // Admins and managers can always cancel; staff only if explicitly permitted
  const canCancel = role === 'admin' || role === 'manager' || canCancelOrders;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected table / panel
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [panelMode, setPanelMode] = useState<'detail' | 'vacant' | 'take-order' | 'add-items' | null>(null);

  // Shared fetch + reconcile logic — used by initial load and background poll
  const fetchTablesAndOrders = useCallback(
    async (opts: { showLoader: boolean; includeMenu: boolean }) => {
      if (opts.showLoader) { setLoading(true); setError(null); }
      try {
        const promises: Promise<unknown>[] = [
          apiClient.getTables(),
          apiClient.listOrders('active'),
        ];
        if (opts.includeMenu) promises.push(apiClient.listMenuItems());

        const [tablesData, ordersData, menuData] = await Promise.all(promises);
        const fetchedTables = tablesData as RestaurantTable[];
        const fetchedOrders = (ordersData as { orders: Order[] }).orders;

        // Reconcile: upgrade vacant table when an active order references it
        const reconciledTables = fetchedTables.map((t) => {
          if (t.is_occupied) return t;
          const match = fetchedOrders.find(
            (o) => o.table_id === t.id || o.id === t.current_order_id
          );
          return match ? { ...t, is_occupied: true, current_order_id: match.id } : t;
        });

        dispatch(setTables(reconciledTables));
        dispatch(setActiveOrders(fetchedOrders));
        if (menuData) dispatch(setMenuItems(menuData as MenuItem[]));
      } catch (err: unknown) {
        if (opts.showLoader)
          setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (opts.showLoader) setLoading(false);
      }
    },
    [dispatch]
  );

  // Load tables, orders, and menu on mount — AppShell WS hub handles all subsequent updates
  useEffect(() => {
    fetchTablesAndOrders({ showLoader: true, includeMenu: !menuHydrated });
  }, [fetchTablesAndOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectedTable in sync with Redux when WS updates arrive (table_status_changed etc.)
  useEffect(() => {
    if (!selectedTable) return;
    const live = tables.find((t) => t.id === selectedTable.id);
    if (live && live !== selectedTable) setSelectedTable(live);
  }, [tables]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close panel when the open order is completed/cancelled by another device
  useEffect(() => {
    if (!selectedTable || panelMode !== 'detail') return;
    const orderStillActive = activeOrders.some((o) => o.id === selectedTable.current_order_id);
    if (!orderStillActive) {
      setSelectedTable(null);
      setPanelMode(null);
    }
  }, [activeOrders, selectedTable, panelMode]);

  // Helpers
  const getOrderForTable = useCallback(
    (table: RestaurantTable): Order | undefined =>
      activeOrders.find(
        (o) => o.id === table.current_order_id || o.table_id === table.id
      ),
    [activeOrders]
  );

  const occupiedCount = tables.filter((t) => t.is_occupied).length;
  const vacantCount = tables.length - occupiedCount;

  const [tableFilter, setTableFilter] = useState<'all' | 'occupied' | 'vacant'>('all');
  const filteredTables = tables.filter((t) => {
    if (tableFilter === 'occupied') return t.is_occupied;
    if (tableFilter === 'vacant') return !t.is_occupied;
    return true;
  });

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
        <>
          <div className="mb-4 flex rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
            {(
              [
                { id: 'all' as const, label: `All (${tables.length})` },
                { id: 'occupied' as const, label: `In use (${occupiedCount})` },
                { id: 'vacant' as const, label: `Empty (${vacantCount})` },
              ]
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setTableFilter(opt.id)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tableFilter === opt.id
                    ? 'border-2 border-primary bg-primary/10 text-primary'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filteredTables.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={tableFilter === 'occupied' ? 'No tables in use' : 'No empty tables'}
              description="Try a different filter."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  order={getOrderForTable(table)}
                  onClick={() => handleTableClick(table)}
                />
              ))}
            </div>
          )}
        </>
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
            canCancel={canCancel}
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
