/**
 * Auto-logout after prolonged user inactivity (web).
 * Tracks pointer/keyboard/touch/visibility; clears auth and redirects to login.
 */

import { useEffect, useRef } from 'react';
import { apiClient } from '../services/api';
import { clearAuth } from '../lib/auth';
import { wsService } from '../services/websocket';

export const IDLE_LOGOUT_MS = 60 * 60 * 1000; // 1 hour

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

export function useIdleLogout(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const logout = () => {
      void (async () => {
        try {
          wsService.disconnect();
          await apiClient.logout();
          clearAuth();
          sessionStorage.setItem('logout_reason', 'idle_timeout');
        } catch {
          // ignore
        }
        window.location.replace('/login');
      })();
    };

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (Date.now() - lastActivityRef.current >= IDLE_LOGOUT_MS) {
          logout();
        } else {
          arm();
        }
      }, IDLE_LOGOUT_MS);
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      arm();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - lastActivityRef.current >= IDLE_LOGOUT_MS) {
          logout();
          return;
        }
        onActivity();
      }
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    arm();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
