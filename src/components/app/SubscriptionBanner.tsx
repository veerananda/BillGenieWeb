import { useState } from 'react';
import { AlertTriangle, Ban, CreditCard, Sparkles } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectProfile } from '../../store/profileSlice';
import { getSubscriptionStatus } from '../../lib/subscriptionStatus';
import { SubscriptionPaywall } from './SubscriptionPaywall';

export function SubscriptionBanner() {
  const profile = useAppSelector(selectProfile);
  const [paywallOpen, setPaywallOpen] = useState(false);

  if (!profile) return null;

  const status = getSubscriptionStatus(profile);
  if (!status) return null;

  const { phase, daysRemaining, isAccessBlocked } = status;

  // pending_payment — payment not yet made
  if (phase === 'pending_payment') {
    return (
      <>
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-white lg:mx-6">
          <CreditCard className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Payment required</p>
            <p className="text-xs text-blue-200">Complete payment to activate your subscription</p>
          </div>
          <button
            onClick={() => setPaywallOpen(true)}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Pay now
          </button>
        </div>
        <SubscriptionPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} onSuccess={() => setPaywallOpen(false)} />
      </>
    );
  }

  // Expired (trial ended or subscription lapsed)
  if (isAccessBlocked) {
    const label = phase === 'trial' ? 'Trial ended' : 'Subscription expired';
    return (
      <>
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-white lg:mx-6">
          <Ban className="h-4 w-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-red-200">Renew your plan to continue using BillGenie</p>
          </div>
          <button
            onClick={() => setPaywallOpen(true)}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
          >
            Renew
          </button>
        </div>
        <SubscriptionPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} onSuccess={() => setPaywallOpen(false)} />
      </>
    );
  }

  // Warning zone — 7 days or fewer remaining
  if (daysRemaining <= 7) {
    const isTrial = phase === 'trial';
    const label = isTrial
      ? `Trial ending in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
      : `Renewal due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
    return (
      <>
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-amber-500 px-4 py-3 text-white lg:mx-6">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1 text-sm font-semibold">{label}</p>
          <button
            onClick={() => setPaywallOpen(true)}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors"
          >
            {isTrial ? 'Subscribe' : 'Renew'}
          </button>
        </div>
        <SubscriptionPaywall open={paywallOpen} onClose={() => setPaywallOpen(false)} onSuccess={() => setPaywallOpen(false)} />
      </>
    );
  }

  // Healthy trial — informational strip
  if (phase === 'trial') {
    return (
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 lg:mx-6">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm text-primary font-medium">
          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left in your 15-day free trial
        </p>
      </div>
    );
  }

  return null;
}
