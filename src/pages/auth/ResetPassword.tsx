import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api';
import { usePageTitle } from '../../hooks/usePageTitle';

export function ResetPassword() {
  usePageTitle('Reset password');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm text-center">
            <img src="/logo.png" alt="BillGenie" className="mx-auto h-14 w-14 rounded-full object-cover shadow-md" />
            <h1 className="mt-6 text-2xl font-bold text-ink">Invalid reset link</h1>
            <p className="mt-2 text-sm text-ink-soft">
              This password reset link is missing or invalid. Request a new one from the login page.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block text-sm font-semibold text-primary hover:text-primary-dark transition"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="BillGenie" className="h-14 w-14 rounded-full object-cover shadow-md" />
            <span className="text-xl font-bold text-ink">BillGenie</span>
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Choose a new password for your account
            </p>
          </div>

          {success ? (
            <div className="mt-8 space-y-5">
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Password updated. You can now sign in with your new password.
              </div>
              <Link
                to="/login"
                className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
              >
                Go to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink">
                  New password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-muted hover:text-ink transition"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-ink">
                  Confirm password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-ink-muted hover:text-ink transition"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-soft">
            Remember your password?{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary-dark transition">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
