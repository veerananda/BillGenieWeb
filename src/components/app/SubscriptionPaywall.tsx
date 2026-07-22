import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, CreditCard, Pencil, Loader2 } from 'lucide-react';
import apiClient from '../../services/api';
import type { SubscriptionRenewalQuote } from '../../services/api';
import { useAppDispatch } from '../../store/hooks';
import { setProfile } from '../../store/profileSlice';
import {
  calculateSubscriptionQuote,
  DEFAULT_SUBSCRIPTION_SELECTION,
  type SubscriptionSelection,
} from '../../data/pricing';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: (r: unknown) => void): void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  canPay?: boolean;
  userRole?: string | null;
  pendingPayment?: boolean;
}

export function SubscriptionPaywall({
  open,
  onClose,
  onSuccess,
  canPay = true,
  userRole = 'admin',
  pendingPayment = false,
}: Props) {
  const dispatch = useAppDispatch();
  const [quote, setQuote] = useState<SubscriptionRenewalQuote | null>(null);
  const [planSelection, setPlanSelection] = useState<SubscriptionSelection>(DEFAULT_SUBSCRIPTION_SELECTION);
  const [editingPlan, setEditingPlan] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPendingActivation = quote?.subscription_phase === 'pending_payment' || pendingPayment;
  const allowsPlanReview = Boolean(quote?.requires_plan_selection) || isPendingActivation;
  const showPlanPicker = allowsPlanReview && (editingPlan || !isPendingActivation);

  const localQuote = useMemo(() => {
    if (!allowsPlanReview) return null;
    return calculateSubscriptionQuote(planSelection);
  }, [planSelection, allowsPlanReview]);

  const displayQuote = useMemo(() => {
    if (allowsPlanReview && localQuote) {
      const sub = planSelection.billing_cycle === 'annual'
        ? localQuote.annual_total
        : localQuote.monthly_subtotal;
      return {
        total_inr: Math.round(sub * 1.18),
        subtotal_inr: sub,
        billing_cycle: planSelection.billing_cycle,
        line_items: localQuote.line_items,
      };
    }
    if (!quote) return null;
    return {
      total_inr: quote.total_inr,
      subtotal_inr: quote.subtotal_inr,
      billing_cycle: quote.billing_cycle,
      line_items: quote.line_items,
    };
  }, [allowsPlanReview, localQuote, planSelection, quote]);

  const loadQuote = useCallback(async (sel?: SubscriptionSelection) => {
    setLoadingQuote(true);
    setError(null);
    try {
      const data = await apiClient.getSubscriptionRenewalQuote(sel);
      setQuote(data);
      if (data.current_selection) {
        setPlanSelection({ ...DEFAULT_SUBSCRIPTION_SELECTION, ...data.current_selection });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load payment details');
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setEditingPlan(false);
      setQuote(null);
      setPaying(false);
      setError(null);
      return;
    }
    loadQuote();
  }, [open, loadQuote]);

  // Re-fetch quote when plan changes (debounced, only when picker is visible)
  useEffect(() => {
    if (!open || !allowsPlanReview || !editingPlan) return;
    const t = setTimeout(() => loadQuote(planSelection), 350);
    return () => clearTimeout(t);
  }, [planSelection, open, allowsPlanReview, editingPlan, loadQuote]);

  async function handlePay() {
    setError(null);
    setPaying(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Payment gateway failed to load. Check your network and try again.');

      const sel = allowsPlanReview ? planSelection : undefined;
      const order = await apiClient.createSubscriptionRenewalOrder(sel);

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          order_id: order.order_id,
          handler: async (response: unknown) => {
            try {
              const r = response as Record<string, string>;
              await apiClient.verifySubscriptionPayment({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
                selection: sel,
              });
              // Refresh profile so banner/status updates
              const profile = await apiClient.getRestaurantProfile();
              dispatch(setProfile(profile));
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        rzp.on('payment.failed', (r: unknown) => {
          const res = r as { error?: { description?: string } };
          reject(new Error(res?.error?.description ?? 'Payment failed'));
        });
        rzp.open();
      });

      onSuccess();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Payment failed';
      if (msg !== 'Payment cancelled') setError(msg);
    } finally {
      setPaying(false);
    }
  }

  if (!open) return null;

  const title = isPendingActivation
    ? showPlanPicker
      ? 'Review your plan'
      : 'Payment required'
    : allowsPlanReview
      ? 'Choose your plan'
      : 'Renew subscription';

  const billingLabel = displayQuote?.billing_cycle === 'annual' ? 'year' : 'month';
  const payCta = isPendingActivation ? 'Complete payment' : 'Pay now';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {canPay ? (
              isPendingActivation ? (
                showPlanPicker
                  ? 'Adjust your plans and add-ons before payment.'
                  : 'Complete payment to continue using this feature.'
              ) : allowsPlanReview ? (
                'Your 15-day free trial has ended. Select a plan and pay to continue.'
              ) : (
                'Renew your subscription to continue using BillGenie.'
              )
            ) : (
              <>
                Please ask your {userRole === 'chef' ? 'manager or admin' : 'admin'} to complete
                payment.
              </>
            )}
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {/* Pending activation: show plan summary with edit button */}
          {isPendingActivation && allowsPlanReview && !showPlanPicker && displayQuote && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
              <p className="text-sm font-bold text-gray-800">Your plan summary</p>
              <ul className="space-y-1">
                {(displayQuote.line_items ?? []).map((item) => (
                  <li key={item.id} className="text-sm text-gray-600">
                    • {item.label}{item.amount > 0 ? ` — ₹${item.amount}` : ''}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setEditingPlan(true)}
                className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit plan
              </button>
            </div>
          )}

          {/* Plan picker */}
          {showPlanPicker && (
            <PlanPicker value={planSelection} onChange={setPlanSelection} />
          )}

          {/* Price display */}
          {loadingQuote && !displayQuote ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : displayQuote ? (
            <div className={`rounded-xl border p-4 space-y-1 ${showPlanPicker ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50'}`}>
              <p className="text-2xl font-extrabold text-gray-900">
                ₹{(displayQuote.total_inr ?? 0).toLocaleString('en-IN')}
                <span className="ml-1 text-sm font-medium text-gray-500">/ {billingLabel}</span>
              </p>
              <p className="text-xs text-gray-500">
                ₹{(displayQuote.subtotal_inr ?? 0).toLocaleString('en-IN')} + 18% GST
              </p>
              {(!isPendingActivation || showPlanPicker) && (
                <ul className="mt-2 space-y-0.5">
                  {(displayQuote.line_items ?? []).slice(0, 8).map((item) => (
                    <li key={item.id} className="text-xs text-gray-600">
                      • {item.label}{item.amount > 0 ? ` — ₹${item.amount}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-2">
          {canPay ? (
            <button
              onClick={handlePay}
              disabled={paying || loadingQuote || !displayQuote}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                </>
              ) : (
                payCta
              )}
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {canPay ? 'Maybe later' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline plan picker ─────────────────────────────────────────────────────

import {
  BASIC_MONTHLY_PRICE, PRICING, MIN_TABLES_DINE_IN, INCLUDED_TABLES_BASIC,
  MAX_TABLES, TABLE_STAFF_BUNDLE_SIZE,
  ADDON_OPTIONS, type OperationMode,
} from '../../data/pricing';

const TABLE_STAFF_BUNDLE_PRICE = PRICING.table_staff_bundle;

export function PlanPicker({ value, onChange, lockBillingCycle = false }: { value: SubscriptionSelection; onChange: (s: SubscriptionSelection) => void; lockBillingCycle?: boolean }) {
  function set(patch: Partial<SubscriptionSelection>) {
    onChange({ ...value, ...patch });
  }

  const modes: { key: OperationMode; label: string }[] = [
    { key: 'dine_in', label: 'Dine-in only' },
    { key: 'counter', label: 'Counter only' },
    { key: 'both', label: 'Dine-in + Counter' },
  ];

  const visibleAddons = ADDON_OPTIONS.filter(
    (a) => !a.onlyFor || a.onlyFor.includes(value.operation_mode)
  );

  const tableBundles = value.operation_mode !== 'counter'
    ? Math.max(0, Math.ceil((value.max_tables - INCLUDED_TABLES_BASIC) / TABLE_STAFF_BUNDLE_SIZE))
    : 0;

  return (
    <div className="space-y-4">
      {/* Billing cycle */}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Billing cycle</p>
        {lockBillingCycle ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 capitalize">
            {value.billing_cycle}
            <span className="ml-2 text-xs font-normal text-gray-500">(locked mid-cycle)</span>
          </p>
        ) : (
          <div className="flex gap-2">
            {(['monthly', 'annual'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set({ billing_cycle: c })}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${value.billing_cycle === c ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                {c === 'monthly' ? 'Monthly' : 'Annual (2 months free)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Service mode */}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Service mode</p>
        <div className="flex gap-2 flex-wrap">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                const patch: Partial<SubscriptionSelection> = { operation_mode: m.key };
                if (m.key === 'counter') patch.max_tables = 0;
                else if (value.max_tables === 0) patch.max_tables = INCLUDED_TABLES_BASIC;
                onChange({ ...value, ...patch });
              }}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${value.operation_mode === m.key ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tables (dine-in) */}
      {value.operation_mode !== 'counter' && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
            Tables — {value.max_tables} tables
            {tableBundles > 0 && <span className="ml-1 font-normal text-gray-400">(+₹{tableBundles * TABLE_STAFF_BUNDLE_PRICE}/mo)</span>}
          </p>
          <input
            type="range"
            min={MIN_TABLES_DINE_IN}
            max={MAX_TABLES}
            step={TABLE_STAFF_BUNDLE_SIZE}
            value={value.max_tables}
            onChange={(e) => set({ max_tables: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>{MIN_TABLES_DINE_IN}</span><span>{INCLUDED_TABLES_BASIC} (included)</span><span>{MAX_TABLES}</span>
          </div>
        </div>
      )}

      {/* Base price */}
      <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
        <p className="text-gray-700">Base plan <span className="font-semibold">₹{BASIC_MONTHLY_PRICE}/mo</span></p>
        {value.operation_mode === 'both' && (
          <p className="text-gray-500 text-xs mt-0.5">Dual service mode +₹{PRICING.dual_service}/mo</p>
        )}
      </div>

      {/* Add-ons */}
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Add-ons</p>
        <div className="space-y-2">
          {visibleAddons.map((addon) => {
            const active = value[addon.key as keyof SubscriptionSelection] as boolean;
            return (
              <label key={addon.key} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => set({ [addon.key]: e.target.checked })}
                  className="accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{addon.title}</p>
                  <p className="text-xs text-gray-500">{addon.description}</p>
                </div>
                <span className="text-xs font-bold text-gray-700 shrink-0">+₹{addon.price}/mo</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
