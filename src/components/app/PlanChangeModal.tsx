import { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import apiClient, {
  type PlanChangeQuote,
  type RestaurantProfile,
} from '../../services/api';
import {
  DEFAULT_SUBSCRIPTION_SELECTION,
  type SubscriptionSelection,
} from '../../data/pricing';
import { PlanPicker } from './SubscriptionPaywall';
import { useAppDispatch } from '../../store/hooks';
import { setProfile } from '../../store/profileSlice';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, cb: (r: unknown) => void): void;
    };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

type Mode = 'upgrade' | 'downgrade';

interface Props {
  open: boolean;
  mode: Mode;
  currentSelection?: SubscriptionSelection | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlanChangeModal({ open, mode, currentSelection, onClose, onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const [selection, setSelection] = useState<SubscriptionSelection>(DEFAULT_SUBSCRIPTION_SELECTION);
  const [quote, setQuote] = useState<PlanChangeQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = useCallback(async (sel: SubscriptionSelection) => {
    setLoadingQuote(true);
    setError(null);
    try {
      const data = await apiClient.getPlanChangeQuote(sel);
      setQuote(data);
    } catch (e: unknown) {
      setQuote(null);
      setError(e instanceof Error ? e.message : 'Could not load plan change quote');
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setQuote(null);
      setError(null);
      setBusy(false);
      return;
    }
    const base = {
      ...DEFAULT_SUBSCRIPTION_SELECTION,
      ...(currentSelection ?? {}),
    };
    setSelection(base);
    void loadQuote(base);
  }, [open, currentSelection, loadQuote]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void loadQuote(selection), 350);
    return () => clearTimeout(t);
  }, [selection, open, loadQuote]);

  async function refreshProfile() {
    const profile = await apiClient.getRestaurantProfile();
    dispatch(setProfile(profile as RestaurantProfile));
  }

  async function handleUpgradePay() {
    if (!quote || quote.change_type !== 'upgrade') {
      setError('Adjust add-ons to increase your plan price for an upgrade.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Payment gateway failed to load.');

      const order = await apiClient.createPlanChangeOrder(selection);

      await new Promise<void>((resolve, reject) => {
        if (order.dev_mode) {
          void apiClient
            .verifyPlanChangePayment({
              razorpay_order_id: order.order_id,
              razorpay_payment_id: `pay_dev_${Date.now()}`,
              razorpay_signature: '',
              selection,
            })
            .then(() => resolve())
            .catch(reject);
          return;
        }

        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: order.name,
          description: order.description,
          order_id: order.order_id,
          handler: (response: unknown) => {
            const r = response as {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            };
            void apiClient
              .verifyPlanChangePayment({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
                selection,
              })
              .then(() => resolve())
              .catch(reject);
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        rzp.on('payment.failed', () => reject(new Error('Payment failed')));
        rzp.open();
      });

      await refreshProfile();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upgrade payment failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleScheduleDowngrade() {
    if (!quote || quote.change_type !== 'downgrade') {
      setError('Choose a lower-priced plan to schedule a downgrade.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.schedulePlanChange(selection);
      await refreshProfile();
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not schedule downgrade');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const title = mode === 'upgrade' ? 'Upgrade plan' : 'Downgrade plan';
  const canSubmitUpgrade = quote?.change_type === 'upgrade' && (quote.amount_due_inr ?? 0) > 0;
  const canSubmitDowngrade = quote?.change_type === 'downgrade';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-sm text-gray-600">
            {mode === 'upgrade'
              ? 'Add add-ons or capacity. You pay the remaining-days price difference plus the next full period at the new plan rate; features apply immediately and your end date extends by one period.'
              : 'Reduce add-ons or capacity. Your current plan stays until the renewal date; the new plan starts then. No charge now.'}
          </p>

          <PlanPicker
            value={selection}
            lockBillingCycle
            onChange={(next) =>
              setSelection({
                ...next,
                billing_cycle: selection.billing_cycle,
              })
            }
          />

          {loadingQuote && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Updating quote…
            </div>
          )}

          {quote && !loadingQuote && (
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Change type</span>
                <span className="font-semibold capitalize text-gray-900">{quote.change_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining days</span>
                <span className="font-medium text-gray-800">{quote.remaining_days}</span>
              </div>
              {quote.change_type === 'upgrade' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Remaining-days difference</span>
                    <span className="font-medium text-gray-800">₹{quote.proration_delta_inr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Next period (new plan)</span>
                    <span className="font-medium text-gray-800">₹{quote.next_period_amount_inr}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-semibold text-gray-900">Pay now</span>
                    <span className="font-bold text-primary">₹{quote.amount_due_inr}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    New end date: {new Date(quote.new_subscription_end).toLocaleDateString('en-IN')}
                  </p>
                </>
              )}
              {quote.change_type === 'downgrade' && (
                <p className="text-xs text-amber-700">
                  Takes effect on {new Date(quote.current_subscription_end).toLocaleDateString('en-IN')}. No payment now.
                </p>
              )}
              {quote.change_type === 'noop' && (
                <p className="text-xs text-gray-500">Selection matches your current plan price and options.</p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          {mode === 'upgrade' ? (
            <button
              type="button"
              disabled={busy || loadingQuote || !canSubmitUpgrade}
              onClick={() => void handleUpgradePay()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {canSubmitUpgrade ? `Pay ₹${quote?.amount_due_inr ?? 0} & upgrade` : 'Increase plan to upgrade'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || loadingQuote || !canSubmitDowngrade}
              onClick={() => void handleScheduleDowngrade()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {canSubmitDowngrade ? 'Schedule downgrade' : 'Lower plan to schedule'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
