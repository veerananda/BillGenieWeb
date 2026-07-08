import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';

export function VerifyEmail() {
  usePageTitle('Verify email');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('This verification link is missing or invalid.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await apiClient.verifyEmail(token);
        if (!cancelled) setSuccess(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Verification failed. The link may have expired.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm text-center">
          <img src="/logo.png" alt="BillGenie" className="mx-auto h-14 w-14 rounded-full object-cover shadow-md" />

          {loading && (
            <div className="mt-8">
              <Loader2 size={32} className="mx-auto animate-spin text-primary" />
              <p className="mt-4 text-sm text-ink-soft">Verifying your email…</p>
            </div>
          )}

          {!loading && success && (
            <div className="mt-8">
              <CheckCircle size={40} className="mx-auto text-green-600" />
              <h1 className="mt-4 text-2xl font-bold text-ink">Email verified</h1>
              <p className="mt-2 text-sm text-ink-soft">
                Your account is confirmed. You can now sign in to BillGenie.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
              >
                Go to login
              </Link>
            </div>
          )}

          {!loading && error && (
            <div className="mt-8">
              <XCircle size={40} className="mx-auto text-red-600" />
              <h1 className="mt-4 text-2xl font-bold text-ink">Verification failed</h1>
              <p className="mt-2 text-sm text-red-700">{error}</p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-semibold text-primary hover:text-primary-dark transition"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
