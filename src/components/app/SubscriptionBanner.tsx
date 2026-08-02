import { AlertTriangle, Ban, CreditCard, Sparkles } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectProfile } from '../../store/profileSlice';
import { getSubscriptionStatus, isPendingPaymentPhase } from '../../lib/subscriptionStatus';
import { useSubscriptionPaywall } from '../../context/SubscriptionPaywallContext';

export function SubscriptionBanner() {
  const profile = useAppSelector(selectProfile);
  const { openPaywall, canPay } = useSubscriptionPaywall();

  if (!profile) return null;

  const status = getSubscriptionStatus(profile);
  if (!status) return null;

  const { phase, daysRemaining, isAccessBlocked } = status;
  const pendingPayment = isPendingPaymentPhase(phase);

  // Chef / staff: single-line notice — no “view details” CTA.
  if (!canPay) {
    if (pendingPayment) {
      return (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-white lg:mx-6">
          <CreditCard className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            Payment pending — notify your admin or manager.
          </p>
        </div>
      );
    }
    if (isAccessBlocked) {
      return (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-white lg:mx-6">
          <Ban className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            Subscription ended — notify your admin or manager.
          </p>
        </div>
      );
    }
    if (daysRemaining <= 7) {
      const isTrial = phase === 'trial';
      return (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-white lg:mx-6">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">
            {isTrial
              ? 'Trial ending soon — notify your admin or manager.'
              : 'Subscription nearing end — notify your admin or manager.'}
          </p>
        </div>
      );
    }
    return null;
  }

  if (pendingPayment) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-white lg:mx-6">
        <CreditCard className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Payment required</p>
          <p className="text-xs text-blue-200">Complete payment to activate your subscription</p>
        </div>
        <button
          onClick={openPaywall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50"
        >
          Complete payment
        </button>
      </div>
    );
  }

  if (isAccessBlocked) {
    const isTrial = phase === 'trial';
    const label = isTrial ? 'Trial ended' : 'Renewal required';
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-white lg:mx-6">
        <Ban className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-red-200">Choose a plan and pay to continue</p>
        </div>
        <button
          onClick={openPaywall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          Complete payment
        </button>
      </div>
    );
  }

  if (daysRemaining <= 7) {
    const isTrial = phase === 'trial';
    const label = isTrial
      ? `Trial ending in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
      : `Renewal due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-amber-500 px-4 py-3 text-white lg:mx-6">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="flex-1 text-sm font-semibold">{label}</p>
        <button
          onClick={openPaywall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-600 transition-colors hover:bg-amber-50"
        >
          {isTrial ? 'Subscribe' : 'Renew'}
        </button>
      </div>
    );
  }

  if (phase === 'trial') {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 lg:mx-6">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-medium text-primary">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left in your 15-day free trial
        </p>
      </div>
    );
  }

  return null;
}
