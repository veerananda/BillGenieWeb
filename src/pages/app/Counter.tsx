import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, X, Minus, Search, ShoppingCart, ChevronRight, Ticket, Percent, Tag,
  ArrowLeftRight, Banknote, Smartphone, Leaf, Beef,
} from 'lucide-react';
import { apiClient, API_BASE_URL } from '../../services/api';
import type { Order, MenuItem, CompletePaymentRequest } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCounterOrders,
  setCounterOrders,
  upsertCounterOrder,
} from '../../store/ordersSlice';
import { selectMenuItems, selectMenuHydrated, setMenuItems } from '../../store/menuSlice';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits } from '../../lib/subscriptionLimits';
import { calculateOrderTotals } from '../../lib/orderCalculations';
import { subtotalLabel, taxLabel } from '../../lib/orderTax';
import { hasUpiPaymentConfigured } from '../../lib/upiPayment';
import { PageHeader } from '../../components/app/PageHeader';
import { Badge } from '../../components/app/Badge';
import { Modal } from '../../components/app/Modal';
import { Spinner } from '../../components/app/Spinner';
import { EmptyState } from '../../components/app/EmptyState';
import { UpiPaymentDisplay } from '../../components/app/UpiPaymentDisplay';
import { TrackingQrModal } from '../../components/app/TrackingQrModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

type ServiceMode = 'eat_here' | 'takeaway';
type PaymentMethod = 'cash' | 'upi' | 'split';
type DietFilter = 'all' | 'veg' | 'non_veg';
type DiscountType = 'amount' | 'percent';

interface PostPaymentQr {
  ticket: number | null;
  trackingUrl: string | null;
  summary: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  return `₹${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusVariant(status: string): 'pending' | 'completed' | 'cancelled' | 'cooking' | 'ready' | 'served' {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

function resolveTrackingUrl(data: {
  tracking_url?: string;
  tracking_token?: string;
} | null | undefined): string | null {
  if (!data) return null;
  if (data.tracking_url) return data.tracking_url;
  if (data.tracking_token) return `${API_BASE_URL}/t/${data.tracking_token}`;
  return null;
}

async function resolveTrackingUrlAfterPayment(
  result: {
    tracking_url?: string;
    tracking_token?: string;
    ticket_number?: number;
    order?: Order;
  },
  orderId: string
): Promise<{ url: string | null; ticket: number | null }> {
  let url =
    resolveTrackingUrl(result) ??
    resolveTrackingUrl(result.order) ??
    null;

  let ticket =
    result.ticket_number ??
    result.order?.ticket_number ??
    result.order?.order_number ??
    null;

  if (!url) {
    try {
      const fresh = await apiClient.getOrder(orderId);
      url = resolveTrackingUrl(fresh);
      ticket = ticket ?? fresh.ticket_number ?? fresh.order_number ?? null;
    } catch {
      // keep payment success even if tracking fetch fails
    }
  }

  return { url, ticket };
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
        isVeg ? 'border-green-600 bg-green-500' : 'border-red-600 bg-red-500'
      }`}
    />
  );
}


function OrderSummaryBlock({
  cart,
  subtotal,
  taxAmount,
  discountValue,
  finalAmount,
  pricesIncludeGst,
  ticketNumber,
}: {
  cart: CartItem[];
  subtotal: number;
  taxAmount: number;
  discountValue: number;
  finalAmount: number;
  pricesIncludeGst: boolean;
  ticketNumber?: number | null;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4 space-y-2">
      {cart.map((c) => (
        <div key={c.menuItemId} className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <VegDot isVeg={c.isVeg} />
            <span className="text-sm text-gray-700 truncate">{c.name}</span>
            <span className="shrink-0 text-xs text-gray-400">×{c.quantity}</span>
          </div>
          <span className="text-sm font-medium text-gray-900 ml-3 shrink-0">
            {fmt(c.price * c.quantity)}
          </span>
        </div>
      ))}
      <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{subtotalLabel(pricesIncludeGst)}</span>
          <span>{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{taxLabel()}</span>
          <span>{fmt(taxAmount)}</span>
        </div>
        {discountValue > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Discount</span>
            <span>−{fmt(discountValue)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
          <span>Total</span>
          <span>{fmt(finalAmount)}</span>
        </div>
      </div>
      {ticketNumber != null && (
        <div className="flex items-center gap-1 text-xs text-gray-400 pt-1">
          <Ticket className="h-3.5 w-3.5" />
          Ticket #{ticketNumber}
        </div>
      )}
    </div>
  );
}

// ─── New Order Slide-over ─────────────────────────────────────────────────────

interface NewOrderPanelProps {
  open: boolean;
  onClose: () => void;
  onCreated: (order: Order) => void;
  onPaymentComplete: (data: PostPaymentQr) => void;
  menuItems: MenuItem[];
}

function NewOrderPanel({ open, onClose, onCreated, onPaymentComplete, menuItems }: NewOrderPanelProps) {
  const profile = useAppSelector(selectProfile);
  const counterModes = profile?.counter_service_modes ?? 'both';
  const pricesIncludeGst = profile?.prices_include_gst ?? false;

  const [serviceMode, setServiceMode] = useState<ServiceMode>('eat_here');
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('amount');
  const [discountValue, setDiscountValue] = useState('');

  const [showCheckout, setShowCheckout] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showSplitCashModal, setShowSplitCashModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  const [cashReceived, setCashReceived] = useState('');
  const [upiTxnId, setUpiTxnId] = useState('');
  const [splitCashPortion, setSplitCashPortion] = useState('');
  const [splitCashGiven, setSplitCashGiven] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const panelWasOpenRef = useRef(false);

  const resetPaymentFields = useCallback(() => {
    setCashReceived('');
    setUpiTxnId('');
    setSplitCashPortion('');
    setSplitCashGiven('');
    setError(null);
  }, []);

  useEffect(() => {
    const justOpened = open && !panelWasOpenRef.current;
    panelWasOpenRef.current = open;

    if (justOpened) {
      setCart([]);
      setSearch('');
      setDietFilter('all');
      setActiveCategory(categories[0] ?? '');
      setShowCheckout(false);
      setShowCashModal(false);
      setShowUpiModal(false);
      setShowSplitCashModal(false);
      setServiceMode(counterModes === 'takeaway' ? 'takeaway' : 'eat_here');
      setCustomerName('');
      setCustomerPhone('');
      setDiscountType('amount');
      setDiscountValue('');
      resetPaymentFields();
      apiClient.getNextCounterTicket().then(setTicketNumber).catch(() => setTicketNumber(null));
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, counterModes, resetPaymentFields]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.filter((m) => m.is_available).forEach((m) => cats.add(m.category));
    return Array.from(cats);
  }, [menuItems]);

  // Default to first category on initial load
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryCount = (cat: string) =>
    menuItems.filter((m) => {
      if (!m.is_available || m.category !== cat) return false;
      if (dietFilter === 'veg' && !m.is_veg) return false;
      if (dietFilter === 'non_veg' && m.is_veg) return false;
      return true;
    }).length;

  const visibleItems = useMemo(() => {
    return menuItems.filter((m) => {
      if (!m.is_available) return false;
      if (dietFilter === 'veg' && !m.is_veg) return false;
      if (dietFilter === 'non_veg' && m.is_veg) return false;
      if (search.trim()) return m.name.toLowerCase().includes(search.toLowerCase());
      return m.category === activeCategory;
    });
  }, [menuItems, dietFilter, activeCategory, search]);

  const orderTotals = useMemo(
    () => calculateOrderTotals(cart, discountValue, discountType, { pricesIncludeGst }),
    [cart, discountValue, discountType, pricesIncludeGst]
  );
  const { subtotal, taxAmount, discountValue: discountAmt, finalAmount } = orderTotals;

  const cashGiven = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashGiven - finalAmount);
  const splitCashPortionAmount = parseFloat(splitCashPortion) || 0;
  const splitUpiAmount = Math.max(0, finalAmount - splitCashPortionAmount);
  const splitCashGivenAmount = parseFloat(splitCashGiven) || 0;
  const splitChange = Math.max(0, splitCashGivenAmount - splitCashPortionAmount);
  const activeUpiAmount = paymentMethod === 'split' ? splitUpiAmount : finalAmount;
  const isSplitCashValid =
    splitCashPortionAmount > 0 && splitUpiAmount > 0.01 && splitCashGivenAmount >= splitCashPortionAmount;

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const showModeToggle = counterModes === 'both';

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id);
      if (ex) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, isVeg: item.is_veg }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => c.menuItemId === id ? { ...c, quantity: c.quantity + delta } : c)
          .filter((c) => c.quantity > 0)
    );
  }

  async function saveOrder(payment: CompletePaymentRequest, summary: string) {
    setProcessing(true);
    setError(null);
    try {
      const createdOrder = await apiClient.createOrder({
        order_type: 'counter',
        service_mode: serviceMode,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items: cart.map((c) => ({ menu_item_id: c.menuItemId, quantity: c.quantity })),
      });

      const result = await apiClient.completeOrderWithPayment(createdOrder.id, payment);
      const { url, ticket: resolvedTicket } = await resolveTrackingUrlAfterPayment(
        result,
        createdOrder.id
      );

      const paidOrder: Order = {
        ...(result.order ?? createdOrder),
        id: createdOrder.id,
        tracking_token: result.tracking_token ?? result.order?.tracking_token,
        tracking_url: url ?? undefined,
        ticket_number: resolvedTicket ?? result.ticket_number ?? result.order?.ticket_number,
      };

      const ticket =
        resolvedTicket ??
        result.ticket_number ??
        paidOrder.ticket_number ??
        createdOrder.ticket_number ??
        createdOrder.order_number ??
        ticketNumber ??
        null;

      setShowCheckout(false);
      setShowCashModal(false);
      setShowUpiModal(false);
      setShowSplitCashModal(false);
      onCreated(paidOrder);
      onPaymentComplete({ ticket, trackingUrl: url, summary });
      resetForNextOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      throw err;
    } finally {
      setProcessing(false);
    }
  }

  async function handleCashPayment() {
    if (cashGiven < finalAmount) {
      setError(`Please enter amount ≥ ${fmt(finalAmount)}`);
      return;
    }
    await saveOrder(
      {
        payment_method: 'cash',
        amount_received: cashGiven,
        change_returned: changeDue,
      } as CompletePaymentRequest,
      `Change: ${fmt(changeDue)}`
    ).catch(() => undefined);
  }

  async function handleUpiPayment() {
    if (paymentMethod !== 'split' && !upiTxnId.trim()) {
      setError('Please enter UPI transaction ID.');
      return;
    }
    if (paymentMethod === 'split' && !isSplitCashValid) {
      setError('Split payment incomplete.');
      return;
    }

    const summary =
      paymentMethod === 'split'
        ? `Cash: ${fmt(splitCashPortionAmount)} | UPI: ${fmt(splitUpiAmount)}`
        : `Amount paid: ${fmt(finalAmount)}`;

    await saveOrder(
      paymentMethod === 'split'
        ? {
            payment_method: 'split',
            cash_amount: splitCashPortionAmount,
            upi_amount: splitUpiAmount,
            amount_received: splitCashGivenAmount,
            change_returned: splitChange,
            upi_transaction_id: upiTxnId.trim() || undefined,
          }
        : {
            payment_method: 'upi',
            amount_received: finalAmount,
            upi_transaction_id: upiTxnId.trim(),
          },
      summary
    ).catch(() => undefined);
  }

  function resetForNextOrder() {
    setCart([]);
    setSearch('');
    setActiveCategory(categories[0] ?? '');
    resetPaymentFields();
    apiClient.getNextCounterTicket().then(setTicketNumber).catch(() => null);
  }

  const paymentFlowActive =
    processing || showCheckout || showCashModal || showUpiModal || showSplitCashModal;

  function openUpiModal(method: PaymentMethod) {
    setPaymentMethod(method);
    setShowCheckout(false);
    if (!hasUpiPaymentConfigured(profile)) {
      setError('Add a UPI ID in Restaurant Profile to show a payment QR with the exact amount.');
    }
    setTimeout(() => setShowUpiModal(true), 150);
  }

  if (!open) return null;

  const summaryProps = {
    cart,
    subtotal,
    taxAmount,
    discountValue: discountAmt,
    finalAmount,
    pricesIncludeGst,
    ticketNumber,
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => { if (!paymentFlowActive) onClose(); }}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New Counter Order</h2>
            {ticketNumber !== null && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <Ticket className="h-3.5 w-3.5" />
                Next ticket:{' '}
                <span className="font-semibold text-primary">#{ticketNumber}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showModeToggle && (
              <div className="flex gap-1.5">
                {(['eat_here', 'takeaway'] as ServiceMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setServiceMode(m)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      serviceMode === m
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {m === 'eat_here' ? 'Eat Here' : 'Takeaway'}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { if (!paymentFlowActive) onClose(); }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Three-column body */}
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
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
              {categories.map((cat) => {
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
                    const inCart = cart.find((c) => c.menuItemId === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => addItem(item)}
                        className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {item.is_veg ? <Leaf size={14} color="#22c55e" /> : <Beef size={14} color="#dc2626" />}
                          <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
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
                  Order ({totalItems} item{totalItems !== 1 ? 's' : ''})
                </div>
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {cart.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-400">Add items from the menu</p>
                ) : (
                  cart.map((c) => (
                    <div key={c.menuItemId} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <VegDot isVeg={c.isVeg} />
                          <p className="truncate text-xs font-medium text-gray-900">{c.name}</p>
                        </div>
                        <p className="ml-4 text-xs text-gray-400">₹{c.price} × {c.quantity}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => changeQty(c.menuItemId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-semibold text-gray-800">{c.quantity}</span>
                        <button
                          onClick={() => changeQty(c.menuItemId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-primary/10 hover:text-primary"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Customer info */}
              <div className="shrink-0 border-t border-gray-100 px-4 py-3 space-y-2">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Total + checkout */}
            <div className="shrink-0 border-t border-gray-100 px-4 py-4 space-y-3">
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Total:</span>
                <span>{fmt(finalAmount)}</span>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Proceed to Checkout
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout review — pick payment method (matches mobile) */}
      <Modal open={showCheckout} onClose={() => setShowCheckout(false)} title="Checkout" maxWidth="sm">
        <div className="space-y-5">
          <OrderSummaryBlock {...summaryProps} />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              Customer <span className="text-xs font-normal text-gray-400">(optional)</span>
            </p>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">
              Discount <span className="text-xs font-normal text-gray-400">(optional)</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDiscountType('amount')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  discountType === 'amount' ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'
                }`}
              >
                <Tag className="h-3.5 w-3.5" /> Amount (₹)
              </button>
              <button
                onClick={() => setDiscountType('percent')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  discountType === 'percent' ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600'
                }`}
              >
                <Percent className="h-3.5 w-3.5" /> Percent (%)
              </button>
            </div>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === 'amount' ? 'Discount amount' : 'Discount %'}
              min="0"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700">Payment Method</p>
            <button
              onClick={() => {
                setPaymentMethod('cash');
                setShowCheckout(false);
                resetPaymentFields();
                setTimeout(() => setShowCashModal(true), 150);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 hover:border-primary hover:bg-primary/5"
            >
              <Banknote className="h-4 w-4" /> Pay by Cash
            </button>
            <button
              onClick={() => {
                resetPaymentFields();
                openUpiModal('upi');
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 hover:border-primary hover:bg-primary/5"
            >
              <Smartphone className="h-4 w-4" /> Pay by UPI
            </button>
            <button
              onClick={() => {
                setPaymentMethod('split');
                resetPaymentFields();
                setShowCheckout(false);
                setTimeout(() => setShowSplitCashModal(true), 150);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-800 hover:border-primary hover:bg-primary/5"
            >
              <ArrowLeftRight className="h-4 w-4" /> Split payment
            </button>
          </div>
        </div>
      </Modal>

      {/* Cash payment */}
      <Modal
        open={showCashModal}
        onClose={() => { setShowCashModal(false); setTimeout(() => setShowCheckout(true), 150); }}
        title="Enter Cash Received"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 px-4 py-4 text-center">
            <p className="text-xs font-medium text-gray-500">Bill Amount</p>
            <p className="text-2xl font-bold text-primary">{fmt(finalAmount)}</p>
          </div>
          <input
            type="number"
            value={cashReceived}
            onChange={(e) => setCashReceived(e.target.value)}
            placeholder={`Amount received (min ${fmt(finalAmount)})`}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {cashGiven > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
              <span className="text-sm font-medium text-green-700">Change Due</span>
              <span className="text-lg font-bold text-green-700">{fmt(changeDue)}</span>
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={() => void handleCashPayment()}
            disabled={processing || cashGiven < finalAmount}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            {processing && <Spinner size="sm" className="text-white" />}
            Payment Complete
          </button>
        </div>
      </Modal>

      {/* Split — cash portion */}
      <Modal
        open={showSplitCashModal}
        onClose={() => { setShowSplitCashModal(false); setTimeout(() => setShowCheckout(true), 150); }}
        title="Split — Cash Portion"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 px-4 py-4 text-center">
            <p className="text-xs font-medium text-gray-500">Total Bill</p>
            <p className="text-2xl font-bold text-primary">{fmt(finalAmount)}</p>
          </div>
          <input
            type="number"
            value={splitCashPortion}
            onChange={(e) => setSplitCashPortion(e.target.value)}
            placeholder="Cash portion (₹)"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {splitCashPortionAmount > 0 && splitUpiAmount > 0 && (
            <div className="flex justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-sm">
              <span className="text-blue-700">UPI remainder</span>
              <span className="font-bold text-blue-700">{fmt(splitUpiAmount)}</span>
            </div>
          )}
          <input
            type="number"
            value={splitCashGiven}
            onChange={(e) => setSplitCashGiven(e.target.value)}
            placeholder={splitCashPortionAmount > 0 ? `Cash received (min ${fmt(splitCashPortionAmount)})` : 'Cash received'}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {splitChange > 0 && (
            <div className="flex justify-between rounded-xl bg-green-50 px-4 py-3 text-sm">
              <span className="text-green-700">Change Due</span>
              <span className="font-bold text-green-700">{fmt(splitChange)}</span>
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={() => {
              if (!isSplitCashValid) {
                setError('Enter a valid cash portion and amount received.');
                return;
              }
              setShowSplitCashModal(false);
              openUpiModal('split');
            }}
            disabled={!isSplitCashValid}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            Accept cash & pay UPI
          </button>
        </div>
      </Modal>

      {/* UPI payment (full or split remainder) */}
      <Modal
        open={showUpiModal}
        onClose={() => {
          setShowUpiModal(false);
          setUpiTxnId('');
          if (paymentMethod === 'split') {
            setTimeout(() => setShowSplitCashModal(true), 150);
          } else {
            setTimeout(() => setShowCheckout(true), 150);
          }
        }}
        title={paymentMethod === 'split' ? 'UPI — remaining balance' : 'UPI Payment'}
        maxWidth="sm"
        zIndexClass="z-[55]"
      >
        <div className="space-y-4">
          <UpiPaymentDisplay profile={profile} amount={activeUpiAmount} transactionNote="Counter order" />

          {paymentMethod === 'split' && (
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Cash portion paid</span>
                <span className="font-semibold text-blue-800">{fmt(splitCashPortionAmount)}</span>
              </div>
            </div>
          )}

          <input
            type="text"
            value={upiTxnId}
            onChange={(e) => setUpiTxnId(e.target.value)}
            placeholder="UPI transaction ID"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={() => void handleUpiPayment()}
            disabled={processing || (paymentMethod !== 'split' && !upiTxnId.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-50"
          >
            {processing && <Spinner size="sm" className="text-white" />}
            Payment Complete
          </button>
        </div>
      </Modal>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Counter() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectProfile);
  const counterOrders = useAppSelector(selectCounterOrders);
  const menuItems = useAppSelector(selectMenuItems);
  const menuHydrated = useAppSelector(selectMenuHydrated);

  const counterKitchenEnabled = useMemo(
    () => parseSubscriptionLimits(profile?.subscription_limits as Record<string, unknown> | undefined).kitchen_counter,
    [profile?.subscription_limits]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [postPaymentQr, setPostPaymentQr] = useState<PostPaymentQr | null>(null);

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

  const sorted = [...counterOrders]
    .filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  function handleOrderCreated(order: Order) {
    dispatch(upsertCounterOrder(order));
  }

  const selectedTrackingUrl = selectedOrder ? resolveTrackingUrl(selectedOrder) : null;
  const selectedTicket =
    selectedOrder?.ticket_number ?? selectedOrder?.order_number ?? null;

  const activeQr: PostPaymentQr | null =
    postPaymentQr ??
    (selectedOrder
      ? {
          ticket: selectedTicket,
          trackingUrl: selectedTrackingUrl,
          summary: `${fmt(selectedOrder.total)} · ${selectedOrder.payment_method?.toUpperCase() ?? 'Paid'}`,
        }
      : null);

  function handleCloseQrModal() {
    setPostPaymentQr(null);
    setSelectedOrder(null);
  }

  return (
    <div>
      <PageHeader
        title="Counter / Takeaway"
        action={
          sorted.length > 0 ? (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
          ) : undefined
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                    {order.ticket_number !== undefined
                      ? `#${order.ticket_number}`
                      : `#${order.order_number}`}
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
                    {fmt(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(order.status ?? '')}>
                      {(order.status ?? '').charAt(0).toUpperCase() + (order.status ?? '').slice(1)}
                    </Badge>
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
        onPaymentComplete={setPostPaymentQr}
        menuItems={menuItems}
      />

      <TrackingQrModal
        open={activeQr !== null}
        onClose={handleCloseQrModal}
        title={postPaymentQr ? 'Payment successful' : 'Order tracking QR'}
        confirmLabel="Close"
        ticketNumber={activeQr?.ticket ?? null}
        trackingUrl={activeQr?.trackingUrl ?? null}
        paymentSummary={activeQr?.summary ?? null}
        kitchenEnabled={counterKitchenEnabled}
        zIndexClass="z-[70]"
      />
    </div>
  );
}
