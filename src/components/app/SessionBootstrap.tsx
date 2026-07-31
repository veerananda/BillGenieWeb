import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '../../services/api';
import { setAuth, clearAuth } from '../../store/authSlice';
import { useAppDispatch } from '../../store/hooks';
import { getAccessToken } from '../../lib/tokenStorage';
import { Spinner } from './Spinner';

/**
 * Restores an access JWT from the httpOnly refresh cookie after a full page load
 * (access token is memory-only and does not survive refresh).
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(() => !!getAccessToken());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (getAccessToken()) {
        if (!cancelled) setReady(true);
        return;
      }

      const hadPriorSession =
        !!localStorage.getItem('restaurant_id') || !!localStorage.getItem('user_role');

      if (!hadPriorSession) {
        if (!cancelled) setReady(true);
        return;
      }

      const auth = await apiClient.restoreSessionFromCookie();
      if (cancelled) return;

      if (auth?.access_token) {
        dispatch(setAuth(auth));
      } else if (apiClient.wasLastRefreshAuthFailure()) {
        // Drop stale local session markers only when the cookie was rejected.
        void apiClient.logout({ skipServer: true });
        dispatch(clearAuth());
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
