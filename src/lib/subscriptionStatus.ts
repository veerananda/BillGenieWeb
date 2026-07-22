export interface SubscriptionStatus {
  subscriptionEnd: Date;
  daysRemaining: number;
  phase: string;
  isExpired: boolean;
  requiresPlanSelection: boolean;
  isAccessBlocked: boolean;
}

export function getSubscriptionStatus(profile: {
  subscription_end?: string;
  subscription_phase?: string;
  requires_plan_selection?: boolean;
}): SubscriptionStatus | null {
  if (!profile.subscription_end) return null;

  const subscriptionEnd = new Date(profile.subscription_end);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (subscriptionEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  const pastEnd = now > subscriptionEnd;
  const phase = profile.subscription_phase ?? '';

  const isAccessBlocked =
    phase === 'pending_payment' ||
    (phase === 'trial' && pastEnd) ||
    (phase === 'active' && pastEnd) ||
    (!phase && pastEnd);

  return {
    subscriptionEnd,
    daysRemaining,
    phase,
    isExpired: isAccessBlocked,
    requiresPlanSelection: profile.requires_plan_selection ?? false,
    isAccessBlocked,
  };
}

export function isPendingPaymentPhase(phase?: string | null): boolean {
  return phase === 'pending_payment';
}

export function canManageSubscription(role?: string | null): boolean {
  return role === 'admin' || role === 'manager';
}
