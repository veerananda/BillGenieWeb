import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { CheckCircle, Loader2, Mail, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';

type LocationState = {
  restaurantId: string;
  email: string;
  loginId: string;
  restaurantCode?: string;
};

export function EmailVerificationPending() {
  usePageTitle('Verify your email');

  const location = useLocation();
  const state = location.state as LocationState | null;

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  if (!state?.restaurantId || !state?.email) {
    return <Navigate to="/register" replace />;
  }

  const { restaurantId, email, loginId, restaurantCode } = state;

  async function handleCheckStatus() {
    setChecking(true);
    setError(null);
    try {
      const status = await apiClient.getVerificationStatus(restaurantId, email);
      if (status.is_email_verified) {
        setVerified(true);
      } else {
        setError('Email not verified yet. Open the link in your inbox, then check again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check verification status.');
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (timer > 0) return;
    setResending(true);
    setError(null);
    try {
      await apiClient.resendVerificationEmail(restaurantId, email);
      setTimer(30);
      const interval = setInterval(() => {
        setTimer((t) => {
          if (t <= 1) {
            clearInterval(interval);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white px-8 py-10 shadow-sm text-center">
          <CheckCircle size={40} className="mx-auto text-green-600" />
          <h1 className="mt-4 text-2xl font-bold text-ink">You&apos;re all set</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Email verified. Sign in with login number <strong>{loginId}</strong>.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <Mail size={48} className="text-primary" />
            <h1 className="text-2xl font-bold text-ink">Verify your email</h1>
            <p className="text-center text-sm text-ink-soft">
              We sent a verification link to <strong>{email}</strong>. Confirm your email before signing in.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <p className="text-ink-soft">Login number</p>
            <p className="font-mono text-lg font-bold text-ink">{loginId}</p>
            {restaurantCode && (
              <>
                <p className="mt-3 text-ink-soft">Restaurant code</p>
                <p className="font-mono font-semibold text-ink">{restaurantCode}</p>
              </>
            )}
          </div>

          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>Check your inbox (and spam folder)</li>
            <li>Click the verification link</li>
            <li>Return here and confirm verification</li>
          </ol>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckStatus}
            disabled={checking}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-60"
          >
            {checking ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            I&apos;ve verified my email
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || timer > 0}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:bg-surface-muted disabled:opacity-60"
          >
            {resending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Resend email {timer > 0 ? `(${timer}s)` : ''}
          </button>

          <p className="mt-6 text-center text-sm text-ink-soft">
            <Link to="/login" className="font-semibold text-primary hover:text-primary-dark transition">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
