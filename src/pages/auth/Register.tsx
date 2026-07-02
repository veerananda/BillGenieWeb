import { useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/api';
import { wsService } from '../../services/websocket';
import { setAuth } from '../../store/authSlice';
import { useAppDispatch } from '../../store/hooks';
import {
  ADDON_OPTIONS,
  BASIC_MONTHLY_PRICE,
  BASIC_FEATURES,
  PRICING,
  formatInr,
  calculateMonthlyTotal,
  DEFAULT_SUBSCRIPTION_SELECTION,
  type SubscriptionSelection,
  type OperationMode,
} from '../../data/pricing';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateLoginId(): string {
  const suffix = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, '0');
  return `100${suffix}`;
}

// ── Step types ─────────────────────────────────────────────────────────────────

interface Step1 {
  restaurantName: string;
  cuisine: string;
  city: string;
  address: string;
}

interface Step2 {
  ownerName: string;
  email: string;
  phone: string;
  loginId: string;
}

// ── Stepper indicator ──────────────────────────────────────────────────────────

const STEPS = ['Restaurant', 'Owner', 'Plan & Password'] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <li key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? 'bg-primary text-white'
                    : active
                    ? 'border-2 border-primary bg-white text-primary'
                    : 'border-2 border-border bg-white text-ink-muted'
                }`}
              >
                {done ? <Check size={14} /> : <span>{idx + 1}</span>}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  active ? 'text-primary' : done ? 'text-ink-soft' : 'text-ink-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`mb-5 h-px flex-1 transition-colors ${
                  done ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Step 1
  const [step1, setStep1] = useState<Step1>({
    restaurantName: '',
    cuisine: '',
    city: '',
    address: '',
  });

  // Step 2
  const [step2, setStep2] = useState<Step2>({
    ownerName: '',
    email: '',
    phone: '',
    loginId: generateLoginId(),
  });

  // Step 3 — subscription mirrors the mobile app's SubscriptionSelection exactly
  const [subscription, setSubscription] = useState<SubscriptionSelection>(
    DEFAULT_SUBSCRIPTION_SELECTION
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleS1Change(field: keyof Step1) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setStep1((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleS2Change(field: keyof Omit<Step2, 'loginId'>) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setStep2((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function setMode(mode: OperationMode) {
    setSubscription((prev) => ({
      ...prev,
      operation_mode: mode,
      // clear kitchen addons that don't apply to new mode
      kitchen_dine_in: mode === 'counter' ? false : prev.kitchen_dine_in,
      kitchen_counter: mode === 'dine_in' ? false : prev.kitchen_counter,
    }));
  }

  function toggleAddon(key: keyof Pick<SubscriptionSelection, 'history_extended' | 'inventory' | 'kitchen_dine_in' | 'kitchen_counter'>) {
    setSubscription((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const copyLoginId = useCallback(() => {
    navigator.clipboard.writeText(step2.loginId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [step2.loginId]);

  // ── Validation ────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    if (!step1.restaurantName.trim()) return 'Restaurant name is required.';
    return null;
  }

  function validateStep2(): string | null {
    if (!step2.ownerName.trim()) return 'Owner name is required.';
    if (!step2.email.trim()) return 'Email is required.';
    if (!/^\S+@\S+\.\S+$/.test(step2.email)) return 'Enter a valid email address.';
    if (!step2.phone.trim()) return 'Phone number is required.';
    return null;
  }

  function validateStep3(): string | null {
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  function goNext() {
    setError(null);
    const err = step === 0 ? validateStep1() : step === 1 ? validateStep2() : null;
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
  }

  function goBack() {
    setError(null);
    setStep((s) => s - 1);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const err = validateStep3();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const response = await apiClient.register({
        restaurant_name: step1.restaurantName.trim(),
        cuisine: step1.cuisine.trim() || undefined,
        city: step1.city.trim() || undefined,
        address: step1.address.trim() || undefined,
        owner_name: step2.ownerName.trim(),
        email: step2.email.trim(),
        phone: step2.phone.trim(),
        login_id: step2.loginId,
        password,
        subscription,
      });
      dispatch(setAuth(response));
      wsService.connect();
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const monthlyTotal = calculateMonthlyTotal(subscription);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-border bg-white px-8 py-10 shadow-sm">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-md">
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <span className="text-xl font-bold text-ink">BillGenie</span>
          </div>

          <div className="mt-2 text-center">
            <h1 className="text-2xl font-bold text-ink">Create your account</h1>
            <p className="mt-1 text-sm text-ink-soft">30-day free trial — no credit card required</p>
          </div>

          <div className="mt-8">
            <StepIndicator current={step} />
          </div>

          {/* ── Step 1: Restaurant info ── */}
          {step === 0 && (
            <div className="mt-8 space-y-5">
              <div>
                <label htmlFor="restaurantName" className="block text-sm font-medium text-ink">
                  Restaurant name <span className="text-red-500">*</span>
                </label>
                <input
                  id="restaurantName"
                  type="text"
                  placeholder="e.g. Spice Garden"
                  value={step1.restaurantName}
                  onChange={handleS1Change('restaurantName')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label htmlFor="cuisine" className="block text-sm font-medium text-ink">
                  Cuisine type <span className="text-xs font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="cuisine"
                  type="text"
                  placeholder="e.g. North Indian, Chinese, Multi-cuisine"
                  value={step1.cuisine}
                  onChange={handleS1Change('cuisine')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-ink">
                  City <span className="text-xs font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="city"
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={step1.city}
                  onChange={handleS1Change('city')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-ink">
                  Address <span className="text-xs font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  id="address"
                  type="text"
                  placeholder="Street, area, landmark"
                  value={step1.address}
                  onChange={handleS1Change('address')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              {/* Service mode */}
              <div>
                <p className="text-sm font-medium text-ink">
                  How do you serve customers? <span className="text-red-500">*</span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'dine_in', label: 'Dine-in', sub: 'Table billing' },
                      { value: 'counter', label: 'Counter', sub: 'Takeaway / quick service' },
                      { value: 'both', label: 'Both', sub: 'Dine-in + counter (+₹199)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition ${
                        subscription.operation_mode === opt.value
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-surface hover:border-ink-muted'
                      }`}
                    >
                      <div className="text-sm font-semibold text-ink">{opt.label}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={goNext}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
              >
                Next: Owner details
              </button>
            </div>
          )}

          {/* ── Step 2: Owner details ── */}
          {step === 1 && (
            <div className="mt-8 space-y-5">
              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-ink">
                  Owner name <span className="text-red-500">*</span>
                </label>
                <input
                  id="ownerName"
                  type="text"
                  placeholder="Full name"
                  value={step2.ownerName}
                  onChange={handleS2Change('ownerName')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="owner@restaurant.com"
                  value={step2.email}
                  onChange={handleS2Change('email')}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-ink">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile number"
                  value={step2.phone}
                  onChange={handleS2Change('phone')}
                  maxLength={10}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              {/* Auto-generated login number */}
              <div>
                <p className="text-sm font-medium text-ink">Your admin login number</p>
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <span className="flex-1 font-mono text-lg font-bold tracking-widest text-primary">
                    {step2.loginId}
                  </span>
                  <button
                    type="button"
                    onClick={copyLoginId}
                    className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
                  >
                    {copied ? (
                      <><CheckCircle2 size={13} />Copied</>
                    ) : (
                      <><Copy size={13} />Copy</>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  This is your admin login number — save it. You will use it with your password every time you log in.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
                >
                  Next: Plan & Password
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Plan & password ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* Basic plan card */}
              <div>
                <p className="text-sm font-medium text-ink">Your plan</p>
                <div className="mt-2 rounded-xl border-2 border-primary bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">Basic</span>
                        <span className="text-sm font-bold text-ink">
                          {formatInr(BASIC_MONTHLY_PRICE)}
                          <span className="text-xs font-normal text-ink-soft">/mo</span>
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {BASIC_FEATURES.slice(0, 4).map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-ink-soft">
                            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {subscription.operation_mode === 'both' && (
                        <div className="mt-2 flex items-baseline justify-between rounded-md bg-primary/10 px-2 py-1">
                          <span className="text-xs text-ink-soft">Dine-in + Counter (both modes)</span>
                          <span className="text-xs font-semibold text-ink">+{formatInr(PRICING.dual_service)}/mo</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Add-ons */}
              <div>
                <p className="text-sm font-medium text-ink">
                  Add-ons <span className="text-xs font-normal text-ink-muted">(optional)</span>
                </p>
                <div className="mt-2 space-y-2">
                  {ADDON_OPTIONS.filter(
                    (a) => !a.onlyFor || a.onlyFor.includes(subscription.operation_mode)
                  ).map((addon) => {
                    const checked = subscription[addon.key];
                    return (
                      <label
                        key={addon.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                          checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-surface hover:border-ink-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleAddon(addon.key)}
                        />
                        <div
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                            checked ? 'border-primary bg-primary' : 'border-border bg-white'
                          }`}
                        >
                          {checked && <Check size={10} strokeWidth={3} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-ink">{addon.title}</span>
                            <span className="shrink-0 text-xs font-semibold text-ink-soft">
                              +{formatInr(addon.price)}/mo
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-muted">{addon.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface-alt px-4 py-2.5 text-sm">
                  <span className="text-ink-soft">Monthly total</span>
                  <span className="font-bold text-ink">{formatInr(monthlyTotal)}/mo</span>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-ink">
                    Create password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
                    Confirm password <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-ink-muted disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" />Creating account…</>
                  ) : (
                    'Create account'
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-soft">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:text-primary-dark transition">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
