import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, MonitorSmartphone } from 'lucide-react';
import { apiClient } from '../../services/api';
import { wsService } from '../../services/websocket';
import { setAuth } from '../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectIsAuthenticated } from '../../store/authSlice';

export function Login() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const registrationNotice =
    (location.state as { registrationMessage?: string } | null)?.registrationMessage ?? null;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  useEffect(() => {
    const reason = sessionStorage.getItem('logout_reason');
    if (reason) {
      setLogoutReason(reason);
      sessionStorage.removeItem('logout_reason');
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.login({ identifier: identifier.trim(), password });
      dispatch(setAuth(response));
      wsService.connect();
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <img src="/logo.png" alt="BillGenie" className="h-14 w-14 rounded-full object-cover shadow-md" />
            <span className="text-xl font-bold text-ink">BillGenie</span>
          </div>

          {/* Registration notice */}
          {registrationNotice && (
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-ink">
              {registrationNotice}
            </div>
          )}

          {/* Device-conflict banner */}
          {logoutReason === 'device_conflict' && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <MonitorSmartphone size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Logged in on another device</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Your account was accessed from another device, so you were signed out here. Please log in again.
                </p>
              </div>
            </div>
          )}

          {logoutReason === 'restaurant_closed' && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <MonitorSmartphone size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Restaurant is closed</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  The owner closed the restaurant. Contact them to reopen before signing in.
                </p>
              </div>
            </div>
          )}

          {/* Heading */}
          <div className="mt-8 text-center">
            <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Sign in to your restaurant dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Identifier */}
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-ink">
                Login number
              </label>
              <p className="mt-0.5 text-xs text-ink-muted">
                8-digit admin number or 6-digit staff key
              </p>
              <input
                id="identifier"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="e.g. 10045231"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                maxLength={8}
                className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 space-y-3 text-center text-sm text-ink-soft">
            <p>
              <Link to="/forgot-login" className="font-medium text-ink-soft hover:text-primary transition">
                Forgot login number?
              </Link>
            </p>
            <p>
              <Link to="/forgot-password" className="font-medium text-ink-soft hover:text-primary transition">
                Forgot password?
              </Link>
            </p>
            <p>
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-primary hover:text-primary-dark transition"
              >
                Start free trial →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
