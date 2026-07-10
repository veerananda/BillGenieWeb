import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Mail, Phone } from 'lucide-react';
import { apiClient } from '../../services/api';

type Method = 'email' | 'phone';
type Stage = 'request' | 'verify' | 'done';

export function ForgotLogin() {
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<Stage>('request');
  const [recoveredId, setRecoveredId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identifier = method === 'email' ? email.trim() : phone.trim();

  async function handleRequestCode(e: FormEvent<HTMLFormElement>) {
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
      await apiClient.requestLoginRecovery(identifier);
      setStage('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.verifyLoginRecovery(identifier, otp.trim());
      setRecoveredId(res.login_id);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white px-8 py-10 shadow-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-ink">Login number found</h1>
          <p className="text-sm text-ink-soft">
            Save this number — you'll use it with your password to sign in.
          </p>
          <div className="rounded-xl border-2 border-primary bg-primary/5 px-6 py-5 space-y-1">
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Your login number</p>
            <p className="text-4xl font-bold tracking-widest text-primary">{recoveredId}</p>
          </div>
          <Link
            to="/login"
            className="inline-block w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white text-center hover:bg-primary-dark transition"
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
        <h1 className="text-2xl font-bold text-ink text-center">Forgot login number?</h1>
        <p className="mt-1.5 text-sm text-ink-soft text-center">
          {stage === 'verify'
            ? 'Enter the 6-digit code sent to your registered email'
            : 'Use your registered email or phone to recover your admin login number'}
        </p>

        {/* Admin-only notice */}
        <div className="mt-6 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-xs text-amber-700 space-y-1">
            <p className="font-semibold text-amber-800">Admin only</p>
            <p>Restaurant admins sign in with an 8-digit number starting with 100.</p>
            <p>Staff members should ask their admin for their login number.</p>
          </div>
        </div>

        {stage === 'request' ? (
          <form onSubmit={handleRequestCode} className="mt-6 space-y-4">
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
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-6 space-y-4">
            <div>
              <p className="text-xs text-ink-muted mb-1.5">Code sent to <span className="font-medium text-ink">{identifier}</span></p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                autoFocus
                className="block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-lg text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition tracking-widest text-center font-semibold"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => { setStage('request'); setOtp(''); setError(null); }}
              disabled={loading}
              className="w-full rounded-lg border border-border py-2.5 text-sm font-medium text-ink-soft hover:border-gray-300 transition"
            >
              Request new code
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary-dark transition">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
