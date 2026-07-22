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

  if (pendingPayment) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-white lg:mx-6">
        <CreditCard className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Payment required</p>
          <p className="text-xs text-blue-200">
            {canPay
              ? 'Complete payment to activate your subscription'
              : 'Ask your admin to complete payment'}
          </p>
        </div>
        <button
          onClick={openPaywall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-50"
        >
          {canPay ? 'Complete payment' : 'View payment info'}
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
          <p className="text-xs text-red-200">
            {canPay
              ? 'Choose a plan and pay to continue'
              : 'Ask your admin to renew the subscription'}
          </p>
        </div>
        <button
          onClick={openPaywall}
          className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
        >
          {canPay ? 'Complete payment' : 'View renewal info'}
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
