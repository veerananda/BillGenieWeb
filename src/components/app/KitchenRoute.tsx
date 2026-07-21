import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { hasKitchenAccess, parseSubscriptionLimits } from '../../lib/subscriptionLimits';

interface Props {
  children: React.ReactNode;
}

export function KitchenRoute({ children }: Props) {
  const profile = useAppSelector(selectProfile);
  const role = useAppSelector(selectAuthRole);
  const limits = parseSubscriptionLimits(
    (profile?.subscription_limits as unknown as Record<string, unknown>) ?? null
  );

  if (!hasKitchenAccess(limits)) {
    const redirectTo = role === 'chef' ? '/app/support' : '/app/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
