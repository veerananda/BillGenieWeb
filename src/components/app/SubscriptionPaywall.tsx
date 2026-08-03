import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, CreditCard, Pencil, Loader2 } from 'lucide-react';
import apiClient from '../../services/api';
import type { SubscriptionRenewalQuote } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectProfile, setProfile } from '../../store/profileSlice';
import {
  billingCycleLabel,
  calculateSubscriptionQuote,
  DEFAULT_SUBSCRIPTION_SELECTION,
  periodSubtotalFromQuote,
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
  const profile = useAppSelector(selectProfile);
  const [quote, setQuote] = useState<SubscriptionRenewalQuote | null>(null);
  const [planSelection, setPlanSelection] = useState<SubscriptionSelection>(DEFAULT_SUBSCRIPTION_SELECTION);
  const [editingPlan, setEditingPlan] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customDealBusy, setCustomDealBusy] = useState(false);

  const isPendingActivation = quote?.subscription_phase === 'pending_payment' || pendingPayment;
  const awaitingCustomDeal = Boolean(quote?.awaiting_custom_deal);
  const customDealReady = Boolean(quote?.is_custom_deal) && !awaitingCustomDeal;
  const allowsPlanReview =
    (Boolean(quote?.requires_plan_selection) || isPendingActivation) && !customDealReady;
  const showPlanPicker =
    allowsPlanReview && (editingPlan || !isPendingActivation || awaitingCustomDeal);

  const localQuote = useMemo(() => {
    if (!allowsPlanReview) return null;
    return calculateSubscriptionQuote(planSelection, profile?.city_tier ?? 'tier_2');
  }, [planSelection, allowsPlanReview, profile?.city_tier]);

  const displayQuote = useMemo(() => {
    if (allowsPlanReview && localQuote) {
      const sub = periodSubtotalFromQuote(localQuote, planSelection.billing_cycle);
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

  const title = awaitingCustomDeal
    ? 'Custom plan in review'
    : customDealReady
      ? 'Custom plan ready'
      : isPendingActivation
        ? showPlanPicker
          ? 'Review your plan'
          : 'Payment required'
        : allowsPlanReview
          ? 'Choose your plan'
          : 'Renew subscription';

  const billingLabel = billingCycleLabel(displayQuote?.billing_cycle || 'quarterly');
  const payCta = customDealReady
    ? 'Pay & activate custom plan'
    : isPendingActivation
      ? 'Complete payment'
      : 'Pay now';

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
            {awaitingCustomDeal ? (
              <>
                Custom plan review is in progress — BillGenie was notified. You can still pick a
                catalog plan below; that withdraws the review. Or wait for pricing and pay when ready.
              </>
            ) : customDealReady && canPay ? (
              <>
                BillGenie confirmed your negotiated plan
                {quote?.current_selection?.max_tables
                  ? ` (up to ${quote.current_selection.max_tables} tables)`
                  : ''}
                . Review the amount below and pay with Razorpay to activate.
              </>
            ) : canPay ? (
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

          {customDealReady && displayQuote ? (
            <div className="rounded-xl border border-primary bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-bold text-gray-800">Your custom plan</p>
              <ul className="space-y-1">
                {(displayQuote.line_items ?? []).map((item) => (
                  <li key={item.id} className="text-sm text-gray-600">
                    • {item.label}{item.amount > 0 ? ` — ₹${item.amount.toLocaleString('en-IN')}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
            <PlanPicker
              value={planSelection}
              onChange={setPlanSelection}
              awaitingCustomDeal={awaitingCustomDeal}
              customDealReady={customDealReady}
              customDealBusy={customDealBusy}
              onRequestCustomDeal={() => {
                if (
                  !window.confirm(
                    'Submit a custom plan review using your restaurant account details?'
                  )
                ) {
                  return;
                }
                void (async () => {
                  try {
                    setCustomDealBusy(true);
                    await apiClient.requestCustomDeal();
                    const data = await apiClient.getSubscriptionRenewalQuote();
                    setQuote(data);
                    if (data.current_selection) {
                      setPlanSelection({
                        ...DEFAULT_SUBSCRIPTION_SELECTION,
                        ...data.current_selection,
                      });
                    }
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : 'Could not submit request');
                  } finally {
                    setCustomDealBusy(false);
                  }
                })();
              }}
              onCancelCustomDealRequest={() => {
                void (async () => {
                  try {
                    setCustomDealBusy(true);
                    await apiClient.cancelCustomDealRequest();
                    const data = await apiClient.getSubscriptionRenewalQuote(planSelection);
                    setQuote(data);
                  } catch {
                    // non-fatal
                  } finally {
                    setCustomDealBusy(false);
                  }
                })();
              }}
            />
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
          {canPay &&
          (!awaitingCustomDeal || (displayQuote?.total_inr || 0) > 0 || customDealReady) ? (
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
            className="w-full rounded-xl border border-primary py-2.5 text-sm font-medium text-primary hover:bg-primary/5 transition-colors"
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
  ADDON_OPTIONS,
  BILLING_CYCLE_OPTIONS,
  PLAN_BANDS,
  SHARED_PLAN_FEATURES,
  bandMonthlyForTier,
  normalizeBillingCycle,
  planBandFromTables,
  tablesForPlanBand,
  type BillingCycle,
  type CityTier,
  type PlanBand,
} from '../../data/pricing';

export function PlanPicker({
  value,
  onChange,
  lockBillingCycle = false,
  cityTier = 'tier_2',
  awaitingCustomDeal = false,
  customDealReady = false,
  onRequestCustomDeal,
  onCancelCustomDealRequest,
  customDealBusy = false,
}: {
  value: SubscriptionSelection;
  onChange: (s: SubscriptionSelection) => void;
  /** @deprecated Billing cycle can always be changed on upgrade/downgrade. */
  lockBillingCycle?: boolean;
  cityTier?: CityTier;
  awaitingCustomDeal?: boolean;
  customDealReady?: boolean;
  onRequestCustomDeal?: () => void;
  onCancelCustomDealRequest?: () => void;
  customDealBusy?: boolean;
}) {
  void lockBillingCycle;
  function set(patch: Partial<SubscriptionSelection>) {
    onChange({ ...value, ...patch });
  }

  const activeBand = planBandFromTables(value.max_tables);
  const setBand = (band: PlanBand) => {
    if (awaitingCustomDeal && onCancelCustomDealRequest) {
      onCancelCustomDealRequest();
    }
    set({ max_tables: tablesForPlanBand(band) });
  };
  const cycle = normalizeBillingCycle(value.billing_cycle);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Choose your plan</p>
        <p className="mb-2 text-xs text-gray-500">
          Pick a size band by table capacity, or request a custom plan — BillGenie already has your restaurant details.
        </p>
        <div className="space-y-2">
          {PLAN_BANDS.map((band) => {
            const active = activeBand === band.id && !awaitingCustomDeal && !customDealReady;
            const price = bandMonthlyForTier(band.id, cityTier);
            return (
              <button
                key={band.id}
                type="button"
                onClick={() => setBand(band.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  active ? 'border-primary bg-primary text-white' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>
                  {band.title} — up to {band.tables} tables · ₹{price}/mo
                </p>
                <p className={`mt-1 text-xs ${active ? 'text-white/85' : 'text-gray-500'}`}>{band.blurb}</p>
              </button>
            );
          })}
          {onRequestCustomDeal || awaitingCustomDeal || customDealReady ? (
            <button
              type="button"
              disabled={customDealBusy || customDealReady || (awaitingCustomDeal && !onRequestCustomDeal)}
              onClick={() => {
                if (awaitingCustomDeal || customDealReady) return;
                onRequestCustomDeal?.();
              }}
              className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                awaitingCustomDeal || customDealReady
                  ? 'border-primary bg-primary/5'
                  : 'border-sky-400 bg-sky-50 hover:border-sky-500'
              } disabled:opacity-70`}
            >
              <p className="text-sm font-semibold text-sky-900">
                {customDealReady
                  ? 'Custom plan ready'
                  : awaitingCustomDeal
                    ? 'Custom plan — review in progress'
                    : 'Need a custom plan?'}
              </p>
              <p className="mt-1 text-xs text-sky-800/80">
                {customDealReady
                  ? 'Pay below to activate your negotiated plan.'
                  : awaitingCustomDeal
                    ? 'BillGenie was notified. You can still pick a catalog plan above — that withdraws this review.'
                    : 'More than 25 tables or a negotiated deal. Tap to submit — we already have your account details.'}
              </p>
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs font-semibold text-gray-500">Every plan includes:</p>
        <ul className="mt-1.5 space-y-1 text-xs text-gray-600">
          {SHARED_PLAN_FEATURES.filter((f) => !f.includes('trial')).map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Optional add-ons</p>
        <div className="space-y-2">
          {ADDON_OPTIONS.map((addon) => {
            const active = Boolean(value[addon.key]);
            return (
              <label
                key={addon.key}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${active ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => set({ [addon.key]: e.target.checked })}
                  className="accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">{addon.title}</p>
                  <p className="text-xs text-gray-500">{addon.description}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-gray-700">+₹{addon.price}/mo</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Billing</p>
        <div className="flex flex-wrap gap-2">
          {BILLING_CYCLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => set({ billing_cycle: opt.id as BillingCycle })}
              className={`min-w-[30%] flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${cycle === opt.id ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {opt.label}
              {opt.hint ? (
                <span className={`mt-0.5 block text-[10px] font-medium ${cycle === opt.id ? 'text-white/85' : 'text-gray-500'}`}>
                  {opt.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
