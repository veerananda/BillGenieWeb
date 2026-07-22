import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, X, Minus, Search, ShoppingCart, ChevronRight,
  ArrowLeftRight, Banknote, CreditCard, Printer, Leaf, Beef,
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
  category: string;
  price: number;
  quantity: number;
  isVeg: boolean;
  isTaxable: boolean;
  notes?: string;
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
  const compositeScheme = profile?.composite_scheme ?? false;
  const pricesIncludeGst = profile?.prices_include_gst ?? false;
  const attendedByUserId = localStorage.getItem('user_id') ?? '';
  const attendedByName = localStorage.getItem('user_name') ?? '';

  const [serviceMode, setServiceMode] = useState<ServiceMode>('eat_here');
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('amount');
  const [discountValue, setDiscountValue] = useState('');

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [splitPhase, setSplitPhase] = useState<'cash' | 'upi'>('cash');

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
      setServiceMode(counterModes === 'takeaway' ? 'takeaway' : 'eat_here');
      setCustomerName('');
      setCustomerPhone('');
      setDiscountType('amount');
      setDiscountValue('');
      setSplitPhase('cash');
      setPaymentMethod('cash');
      resetPaymentFields();
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
    () => calculateOrderTotals(cart, discountValue, discountType, { pricesIncludeGst, compositeScheme }),
    [cart, discountValue, discountType, pricesIncludeGst, compositeScheme]
  );
  const { subtotal, taxAmount, discountValue: discountAmt, finalAmount, showTax } = orderTotals;

  const cashGiven = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashGiven - finalAmount);
  const splitCashPortionAmount = parseFloat(splitCashPortion) || 0;
  const splitUpiAmount = Math.max(0, finalAmount - splitCashPortionAmount);
  const splitCashGivenAmount = parseFloat(splitCashGiven) || 0;
  const splitChange = Math.max(0, splitCashGivenAmount - splitCashPortionAmount);
  const isSplitCashValid =
    splitCashPortionAmount > 0 && splitUpiAmount > 0.01 && splitCashGivenAmount >= splitCashPortionAmount;

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const showModeToggle = counterModes === 'both';

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const ex = prev.find((c) => c.menuItemId === item.id);
      if (ex) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, category: item.category, price: item.price, quantity: 1, isVeg: item.is_veg, isTaxable: item.is_taxable !== false }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => c.menuItemId === id ? { ...c, quantity: c.quantity + delta } : c)
          .filter((c) => c.quantity > 0)
    );
  }

  function changeNotes(id: string, notes: string) {
    setCart((prev) => prev.map((c) => c.menuItemId === id ? { ...c, notes } : c));
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
        items: cart.map((c) => ({
          menu_item_id: c.menuItemId,
          quantity: c.quantity,
          notes: c.notes?.trim() || undefined,
        })),
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
        null;

      setShowCheckout(false);
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
        ...attendantPayload,
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
            ...attendantPayload,
          }
        : {
            payment_method: 'upi',
            amount_received: finalAmount,
            upi_transaction_id: upiTxnId.trim(),
            ...attendantPayload,
          },
      summary
    ).catch(() => undefined);
  }

  function resetForNextOrder() {
    setCart([]);
    setSearch('');
    setActiveCategory(categories[0] ?? '');
    resetPaymentFields();
  }

  const paymentFlowActive = processing || showCheckout;
  const attendantPayload = attendedByUserId ? { attended_by_user_id: attendedByUserId } : {};

  function handlePrintBill() {
    const html = `<html><body style="font-family:monospace;padding:20px;max-width:400px;margin:auto">
      <h2 style="text-align:center">Counter Order</h2>
      ${customerName.trim() ? `<p>Customer: ${customerName.trim()}</p>` : ''}
      ${attendedByName ? `<p>Attended by: ${attendedByName}</p>` : ''}
      <hr/>
      ${cart.map((c) => `<div style="display:flex;justify-content:space-between"><span>${c.name} ×${c.quantity}</span><span>₹${(c.price * c.quantity).toFixed(2)}</span></div>`).join('')}
      <hr/>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      ${showTax ? `<div style="display:flex;justify-content:space-between"><span>GST (5%)</span><span>₹${taxAmount.toFixed(2)}</span></div>` : ''}
      ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;color:green"><span>Discount</span><span>-₹${discountAmt.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:4px;border-top:1px solid #ccc;padding-top:4px"><span>Total</span><span>₹${finalAmount.toFixed(2)}</span></div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  async function handleConfirmPayment() {
    if (paymentMethod === 'cash') {
      await handleCashPayment();
    } else if (paymentMethod === 'upi') {
      await handleUpiPayment();
    } else {
      if (splitPhase === 'cash') {
        if (!isSplitCashValid) { setError('Enter a valid cash portion and amount received.'); return; }
        setError(null);
        setSplitPhase('upi');
      } else {
        await handleUpiPayment();
      }
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => { if (!paymentFlowActive) onClose(); }}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-5xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New Counter Order</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (!paymentFlowActive) onClose(); }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {showModeToggle && (
          <div className="shrink-0 border-b border-gray-100 bg-primary/5 px-6 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Service mode</p>
                <p className="text-xs text-gray-500">Choose how this counter order will be served.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:w-80">
                {(['eat_here', 'takeaway'] as ServiceMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setServiceMode(m)}
                    className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                      serviceMode === m
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    {m === 'eat_here' ? 'Eat Here' : 'Takeaway'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
          <div className="flex w-80 shrink-0 flex-col border-l border-gray-100">
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
                    <div key={c.menuItemId} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-medium text-gray-900">{c.name}</p>
                            {c.isVeg
                              ? <Leaf size={13} color="#22c55e" className="shrink-0" />
                              : <Beef size={13} color="#dc2626" className="shrink-0" />}
                          </div>
                          {c.category ? (
                            <p className="truncate text-xs text-gray-400">{c.category}</p>
                          ) : null}
                          <p className="text-xs text-gray-400">₹{c.price}</p>
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
                      <input
                        type="text"
                        value={c.notes ?? ''}
                        onChange={(e) => changeNotes(c.menuItemId, e.target.value)}
                        placeholder="Chef note (optional)"
                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
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
                Proceed to Payment
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout — consolidated two-column modal matching Orders & Billing */}
      <Modal
        open={showCheckout}
        onClose={() => { if (!processing) { setShowCheckout(false); setSplitPhase('cash'); setError(null); } }}
        title="Checkout"
        maxWidth="3xl"
      >
        <div className="flex gap-6">
          {/* ── Left: order items + subtotal + GST ── */}
          <div className="w-64 shrink-0">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Order items</p>
              <div className="space-y-2">
                {cart.map((c) => (
                  <div key={c.menuItemId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <VegDot isVeg={c.isVeg} />
                        <span className="truncate text-sm text-gray-700">{c.name}</span>
                      </div>
                      {c.category ? <p className="ml-4 text-xs text-gray-400">{c.category}</p> : null}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-900">
                      {c.quantity}× {fmt(c.price)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 pt-2 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {showTax && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>GST (5%)</span>
                    <span>{fmt(taxAmount)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: discount + print + payment ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Apply Discount */}
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 space-y-3 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">Apply Discount (Optional)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => { setDiscountType('amount'); setDiscountValue(''); }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    discountType === 'amount' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >₹</button>
                <button
                  onClick={() => { setDiscountType('percent'); setDiscountValue(''); }}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                    discountType === 'percent' ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >%</button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">Total Amount</span>
                <span className="text-lg font-bold text-primary">{fmt(finalAmount)}</span>
              </div>
            </div>

            {/* Staff print */}
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 space-y-2 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">Staff print</p>
              <button
                type="button"
                onClick={handlePrintBill}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Printer className="h-4 w-4" />
                Print bill
              </button>
            </div>

            {/* Payment Method */}
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
                      onClick={() => { setPaymentMethod(tab.value); setSplitPhase('cash'); setError(null); resetPaymentFields(); }}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                        paymentMethod === tab.value ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tab.icon}{tab.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setPaymentMethod('split'); setSplitPhase('cash'); setError(null); resetPaymentFields(); }}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors ${
                    paymentMethod === 'split' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4" />Split payment
                </button>
              </div>

              {/* Cash inputs */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-medium text-gray-600">Amount received (₹)</label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder={String(finalAmount)}
                    min={finalAmount}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {cashGiven > 0 && !isNaN(cashGiven) && (
                    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
                      <span className="text-gray-600">Change to Return</span>
                      <span className={`font-semibold ${changeDue < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(Math.max(0, changeDue))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* UPI inputs */}
              {paymentMethod === 'upi' && (
                <div className="space-y-3 pt-1">
                  <UpiPaymentDisplay profile={profile} amount={finalAmount} transactionNote="Counter order" />
                  <input
                    type="text"
                    value={upiTxnId}
                    onChange={(e) => setUpiTxnId(e.target.value)}
                    placeholder="Enter transaction ID after payment (optional)"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Split — cash phase */}
              {paymentMethod === 'split' && splitPhase === 'cash' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Cash portion</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                      <input type="number" value={splitCashPortion} onChange={(e) => setSplitCashPortion(e.target.value)} placeholder="0" min={0} max={finalAmount}
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    {splitCashPortionAmount > 0 && <p className="mt-1 text-xs text-gray-500">UPI remainder: <span className="font-semibold text-primary">{fmt(splitUpiAmount)}</span></p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">Cash received</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                      <input type="number" value={splitCashGiven} onChange={(e) => setSplitCashGiven(e.target.value)} placeholder={String(splitCashPortionAmount || 0)} min={splitCashPortionAmount}
                        className="w-full rounded-xl border border-gray-200 py-2.5 pl-8 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    {splitChange > 0 && <p className="mt-1 text-xs text-gray-500">Change to return: <span className="font-semibold">{fmt(splitChange)}</span></p>}
                  </div>
                </div>
              )}

              {/* Split — UPI phase */}
              {paymentMethod === 'split' && splitPhase === 'upi' && (
                <div className="space-y-3 pt-1">
                  <UpiPaymentDisplay profile={profile} amount={splitUpiAmount} transactionNote="Counter order (UPI portion)" />
                  <div className="flex justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-sm">
                    <span className="text-blue-700">Cash paid</span>
                    <span className="font-semibold text-blue-800">{fmt(splitCashPortionAmount)}</span>
                  </div>
                  <input
                    type="text"
                    value={upiTxnId}
                    onChange={(e) => setUpiTxnId(e.target.value)}
                    placeholder="Enter UPI transaction ID (optional)"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (paymentMethod === 'split' && splitPhase === 'upi') { setSplitPhase('cash'); setError(null); }
                  else { setShowCheckout(false); setSplitPhase('cash'); setError(null); }
                }}
                disabled={processing}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={() => void handleConfirmPayment()}
                disabled={processing || (paymentMethod === 'cash' && cashGiven > 0 && cashGiven < finalAmount)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {processing ? <Spinner size="sm" className="text-white" /> : null}
                <span className="text-center leading-tight">
                  {paymentMethod === 'split' && splitPhase === 'cash' ? <>Accept Cash<br />&amp; Pay UPI</> : 'Confirm Payment'}
                </span>
              </button>
            </div>
          </div>
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
          title="No active counter orders"
          description="Paid orders waiting in kitchen will appear here. Tap New Order to start."
          action={
            <button
              onClick={() => setPanelOpen(true)}
              className="mt-2 flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
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
