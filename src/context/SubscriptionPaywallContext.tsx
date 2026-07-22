import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAuthRole } from '../store/authSlice';
import { selectProfile } from '../store/profileSlice';
import {
  canManageSubscription,
  getSubscriptionStatus,
  isPendingPaymentPhase,
} from '../lib/subscriptionStatus';
import { subscribeSubscriptionPaywall } from '../lib/subscriptionPaywall';
import { SubscriptionPaywall } from '../components/app/SubscriptionPaywall';

interface SubscriptionPaywallContextValue {
  isAccessBlocked: boolean;
  isPendingPayment: boolean;
  daysRemaining: number;
  canPay: boolean;
  openPaywall: () => void;
  guardAction: (action: () => void) => void;
}

const SubscriptionPaywallContext = createContext<SubscriptionPaywallContextValue>({
  isAccessBlocked: false,
  isPendingPayment: false,
  daysRemaining: 0,
  canPay: false,
  openPaywall: () => {},
  guardAction: (action) => action(),
});

export function SubscriptionPaywallProvider({ children }: { children: ReactNode }) {
  const profile = useAppSelector(selectProfile);
  const role = useAppSelector(selectAuthRole);
  const [visible, setVisible] = useState(false);

  const status = useMemo(() => (profile ? getSubscriptionStatus(profile) : null), [profile]);

  const isAccessBlocked = Boolean(status?.isAccessBlocked);
  const isPendingPayment = isPendingPaymentPhase(status?.phase);
  const daysRemaining = status?.daysRemaining ?? 0;
  const canPay = canManageSubscription(role);

  const openPaywall = useCallback(() => {
    setVisible(true);
  }, []);

  const guardAction = useCallback(
    (action: () => void) => {
      if (isAccessBlocked) {
        openPaywall();
        return;
      }
      action();
    },
    [isAccessBlocked, openPaywall]
  );

  useEffect(() => {
    if (!profile?.id) {
      setVisible(false);
    }
  }, [profile?.id]);

  useEffect(() => subscribeSubscriptionPaywall(openPaywall), [openPaywall]);

  const value = useMemo(
    () => ({
      isAccessBlocked,
      isPendingPayment,
      daysRemaining,
      canPay,
      openPaywall,
      guardAction,
    }),
    [isAccessBlocked, isPendingPayment, daysRemaining, canPay, openPaywall, guardAction]
  );

  return (
    <SubscriptionPaywallContext.Provider value={value}>
      {children}
      <SubscriptionPaywall
        open={visible}
        onClose={() => setVisible(false)}
        onSuccess={() => setVisible(false)}
        canPay={canPay}
        userRole={role}
        pendingPayment={isPendingPayment}
      />
    </SubscriptionPaywallContext.Provider>
  );
}

export function useSubscriptionPaywall(): SubscriptionPaywallContextValue {
  return useContext(SubscriptionPaywallContext);
}
