import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Mail, Phone } from 'lucide-react';
import { apiClient } from '../../services/api';

type Method = 'email' | 'phone';

export function ForgotPassword() {
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const identifier = method === 'email' ? email.trim() : phone.trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identifier) {
      setError(method === 'email' ? 'Please enter your registered email' : 'Please enter your registered phone number');
      return;
    }
    if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.forgotPassword(identifier);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white px-8 py-10 shadow-sm text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-ink">Check your email</h1>
          <p className="text-sm text-ink-soft">
            A password reset link has been sent to your registered email. The link expires in 1 hour. Check your spam folder if you don't see it.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white text-center hover:bg-primary-dark transition"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
        <h1 className="text-2xl font-bold text-ink text-center">Reset Password</h1>
        <p className="mt-1.5 text-sm text-ink-soft text-center">
          Use your registered email or phone to receive a reset link
        </p>

        {/* Admin-only notice */}
        <div className="mt-6 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-xs text-amber-700 space-y-1">
            <p className="font-semibold text-amber-800">Admin only</p>
            <p>Sign in with your 8-digit login number. Use email or phone here only to recover your password.</p>
            <p>Staff members should ask their admin to reset their password.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {/* Method tabs */}
          <div className="flex gap-2">
            {(['email', 'phone'] as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  method === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-ink-soft hover:border-gray-300'
                }`}
              >
                {m === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                {m === 'email' ? 'Email' : 'Phone'}
              </button>
            ))}
          </div>

          {method === 'email' ? (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Registered email address"
              autoComplete="email"
              className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          ) : (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Registered phone number"
              autoComplete="tel"
              className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
            />
          )}

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
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary-dark transition">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
