import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { hasKitchenAccess, parseSubscriptionLimits } from '../../lib/subscriptionLimits';
import { getDefaultAppPath } from '../../lib/defaultAppPath';

/** Role-aware landing when visiting /app (Dashboard nav is hidden). */
export function AppHomeRedirect() {
  const role = useAppSelector(selectAuthRole);
  const profile = useAppSelector(selectProfile);
  const limits = parseSubscriptionLimits(
    (profile?.subscription_limits as unknown as Record<string, unknown>) ?? null
  );
  return (
    <Navigate
      to={getDefaultAppPath(role, { hasKitchenAccess: hasKitchenAccess(limits) })}
      replace
    />
  );
}
