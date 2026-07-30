import { useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Copy, Loader2, Eye, EyeOff, Sparkles, CreditCard } from 'lucide-react';
import { apiClient } from '../../services/api';
import {
  TRIAL_DURATION_DAYS,
  formatInr,
  calculateSubscriptionQuote,
  DEFAULT_SUBSCRIPTION_SELECTION,
  type SubscriptionSelection,
  type CityTier,
} from '../../data/pricing';
import { PlanPicker } from '../../components/app/SubscriptionPaywall';
import { INDIA_LOCATION_OPTIONS, citiesForState, resolveCityTier } from '../../data/indiaLocations';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateLoginId(): string {
  const suffix = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `100${suffix}`;
}

// ── Step types ────────────────────────────────────────────────────────────────

type StartMode = 'trial' | 'paid' | 'custom_request';

interface Step1 { restaurantName: string; cuisine: string; city: string; address: string; state: string; }
interface Step2 { ownerName: string; email: string; phone: string; }

type CustomRequestForm = {
  max_tables: number;
  extra_staff: number;
  extra_chefs: number;
  extra_managers: number;
  inventory: boolean;
  expenses: boolean;
  history_extended: boolean;
  notes: string;
};

const DEFAULT_CUSTOM_REQUEST: CustomRequestForm = {
  max_tables: 26,
  extra_staff: 0,
  extra_chefs: 0,
  extra_managers: 0,
  inventory: false,
  expenses: false,
  history_extended: false,
  notes: '',
};

const TRIAL_INCLUDES = [
  `${TRIAL_DURATION_DAYS}-day free trial — full access, no credit card needed`,
  'Dine-in + counter + kitchen',
  'Starter limits — up to 10 dine-in tables',
  'Menu management (unlimited items)',
  'Order management & checkout',
  'Sales reports & 90-day order history',
  '1 admin · 1 manager · 2 staff · 1 chef',
] as const;

// ── Stepper ───────────────────────────────────────────────────────────────────

const STEPS = ['Restaurant', 'Owner', 'Plan', 'Security'] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex w-full items-start">
      {STEPS.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        const last = idx === STEPS.length - 1;
        return (
          <div key={label} className={`flex items-start ${last ? 'flex-none' : 'flex-1'}`}>
            {/* Circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done ? 'bg-primary text-white' : active ? 'border-2 border-primary text-primary' : 'border-2 border-gray-200 text-gray-400'
                }`}
              >
                {done ? <Check size={14} /> : <span>{idx + 1}</span>}
              </div>
              <span className={`mt-1.5 text-xs font-medium whitespace-nowrap ${active ? 'text-primary' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {/* Connector — only between steps */}
            {!last && (
              <div className={`mt-4 h-px flex-1 mx-1 transition-colors ${done ? 'bg-primary' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}


function PlanStep({
  subscription,
  onChange,
  cityTier,
}: {
  subscription: SubscriptionSelection;
  onChange: (s: SubscriptionSelection) => void;
  cityTier: CityTier;
}) {
  const quote = useMemo(() => calculateSubscriptionQuote(subscription, cityTier), [cityTier, subscription]);
  const displayTotal =
    subscription.billing_cycle === 'annual'
      ? `${formatInr(quote.annual_total)}/year`
      : `${formatInr(quote.monthly_subtotal)}/month`;

  return (
    <div className="space-y-4">
      <PlanPicker value={subscription} onChange={onChange} cityTier={cityTier} />
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs text-gray-600">
          {subscription.billing_cycle === 'annual' ? 'Estimated after trial' : 'Estimated monthly (excl. 18% GST)'}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-primary">{displayTotal}</p>
        <p className="mt-1 text-xs text-gray-600">
          Includes {quote.bundled_staff} staff · {quote.bundled_chefs} chef{quote.bundled_chefs === 1 ? '' : 's'} · {quote.bundled_managers} manager{quote.bundled_managers === 1 ? '' : 's'} · {quote.selection.max_tables} tables.
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [step1, setStep1] = useState<Step1>({ restaurantName: '', cuisine: '', city: '', address: '', state: '' });
  const [step2, setStep2] = useState<Step2>({ ownerName: '', email: '', phone: '' });
  const [startMode, setStartMode] = useState<StartMode>('trial');
  const [subscription, setSubscription] = useState<SubscriptionSelection>(DEFAULT_SUBSCRIPTION_SELECTION);
  const [customRequest, setCustomRequest] = useState<CustomRequestForm>(DEFAULT_CUSTOM_REQUEST);
  const [loginId] = useState(generateLoginId);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────────

  function s1(field: keyof Step1) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setStep1((p) => ({ ...p, [field]: e.target.value }));
  }

  function s2(field: keyof Step2) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setStep2((p) => ({ ...p, [field]: e.target.value }));
  }

  const copyLoginId = useCallback(() => {
    navigator.clipboard.writeText(loginId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [loginId]);
  const cityOptions = useMemo(() => citiesForState(step1.state), [step1.state]);
  const cityTier = useMemo<CityTier>(() => resolveCityTier(step1.state, step1.city), [step1.state, step1.city]);

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (step === 0) {
      if (!step1.restaurantName.trim()) return 'Restaurant name is required.';
      if (!step1.state.trim()) return 'State is required.';
      if (!step1.city.trim()) return 'City is required.';
    } else if (step === 1) {
      if (!step2.ownerName.trim()) return 'Owner name is required.';
      if (!step2.email.trim()) return 'Email is required.';
      if (!/^\S+@\S+\.\S+$/.test(step2.email)) return 'Enter a valid email address.';
      if (!step2.phone.trim()) return 'Phone number is required.';
    } else if (step === 3) {
      if (!password) return 'Password is required.';
      if (password.length < 6) return 'Password must be at least 6 characters.';
      if (password !== confirmPassword) return 'Passwords do not match.';
    }
    return null;
  }

  function goNext() {
    setError(null);
    const err = validate();
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
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    try {
      const response = await apiClient.register({
        restaurant_name: step1.restaurantName.trim(),
        cuisine: step1.cuisine.trim() || undefined,
        city: step1.city.trim(),
        state: step1.state.trim(),
        address: step1.address.trim() || undefined,
        owner_name: step2.ownerName.trim(),
        email: step2.email.trim(),
        phone: step2.phone.trim(),
        login_id: loginId,
        password,
        start_mode: startMode,
        subscription: startMode === 'paid' ? subscription : undefined,
        custom_deal_request:
          startMode === 'custom_request'
            ? {
                ...customRequest,
                billing_cycle: 'monthly',
                notes: customRequest.notes.trim() || undefined,
                contact_phone: step2.phone.trim() || undefined,
              }
            : undefined,
      });
      const customMsg =
        startMode === 'custom_request'
          ? ` Custom plan request received — BillGenie will confirm pricing, then you can pay from the app.`
          : '';
      navigate('/login', {
        replace: true,
        state: {
          registrationMessage: `We sent a verification link to ${response.email}. Open the link in your email, then sign in. Your login number is ${response.login_id}.${customMsg} Once BillGenie reviews and approves your restaurant, you'll get a confirmation email and can start using BillGenie.`,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition';
  const labelCls = 'block text-sm font-medium text-gray-900';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">

          {/* Logo */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <img src="/logo.png" alt="BillGenie" className="h-14 w-14 rounded-full object-cover shadow-md" />
            <span className="text-xl font-bold text-gray-900">BillGenie</span>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="mt-1 text-sm text-gray-500">{TRIAL_DURATION_DAYS}-day free trial — no credit card required</p>
            </div>
          </div>

          {/* Stepper */}
          <StepIndicator current={step} />

          <div className="mt-8">
            {/* ── Step 0: Restaurant info ── */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Restaurant name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="e.g. Spice Garden" value={step1.restaurantName} onChange={s1('restaurantName')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cuisine type <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                  <input type="text" placeholder="e.g. North Indian, Chinese" value={step1.cuisine} onChange={s1('cuisine')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>State <span className="text-red-500">*</span></label>
                  <select
                    value={step1.state}
                    onChange={(e) => setStep1((p) => ({ ...p, state: e.target.value, city: '' }))}
                    className={inputCls}
                  >
                    <option value="">Select state</option>
                    {INDIA_LOCATION_OPTIONS.map((item) => (
                      <option key={item.state} value={item.state}>{item.state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>City <span className="text-red-500">*</span></label>
                  <select
                    value={step1.city}
                    onChange={(e) => setStep1((p) => ({ ...p, city: e.target.value }))}
                    className={inputCls}
                    disabled={!step1.state}
                  >
                    <option value="">{step1.state ? 'Select city' : 'Select state first'}</option>
                    {cityOptions.map((item) => (
                      <option key={item.name} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Address <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                  <input type="text" placeholder="Street, area, landmark" value={step1.address} onChange={s1('address')} className={inputCls} />
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <NavButtons onNext={goNext} nextLabel="Next: Owner details" />
              </div>
            )}

            {/* ── Step 1: Owner info ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Owner name <span className="text-red-500">*</span></label>
                  <input type="text" placeholder="Full name" value={step2.ownerName} onChange={s2('ownerName')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                  <input type="email" autoComplete="email" placeholder="owner@restaurant.com" value={step2.email} onChange={s2('email')} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
                  <input type="tel" inputMode="numeric" placeholder="10-digit mobile number" value={step2.phone} onChange={s2('phone')} maxLength={10} className={inputCls} />
                </div>
                {error && <ErrorBox>{error}</ErrorBox>}
                <NavButtons onBack={goBack} onNext={goNext} nextLabel="Next: Plan" />
              </div>
            )}

            {/* ── Step 2: Plan ── */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Start mode picker */}
                <div>
                  <p className="text-sm font-semibold text-gray-900">How do you want to start?</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {/* Free trial card */}
                    <button
                      type="button"
                      onClick={() => setStartMode('trial')}
                      className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
                        startMode === 'trial'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${startMode === 'trial' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Sparkles size={18} />
                      </div>
                      <p className={`mt-3 text-sm font-bold ${startMode === 'trial' ? 'text-primary' : 'text-gray-900'}`}>
                        Free trial
                      </p>
                      <p className="mt-1 text-xs text-gray-500">{TRIAL_DURATION_DAYS} days, no card needed</p>
                      {startMode === 'trial' && (
                        <div className="mt-1.5 flex h-5 w-5 items-center justify-center self-end rounded-full bg-primary">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </button>

                    {/* Subscribe now card */}
                    <button
                      type="button"
                      onClick={() => setStartMode('paid')}
                      className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
                        startMode === 'paid'
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${startMode === 'paid' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <CreditCard size={18} />
                      </div>
                      <p className={`mt-3 text-sm font-bold ${startMode === 'paid' ? 'text-primary' : 'text-gray-900'}`}>
                        Subscribe now
                      </p>
                      <p className="mt-1 text-xs text-gray-500">Pick a plan &amp; start today</p>
                      {startMode === 'paid' && (
                        <div className="mt-1.5 flex h-5 w-5 items-center justify-center self-end rounded-full bg-primary">
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </div>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStartMode('custom_request')}
                    className={`mt-3 flex w-full flex-col items-start rounded-xl border-2 p-4 text-left transition ${
                      startMode === 'custom_request'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-bold ${startMode === 'custom_request' ? 'text-primary' : 'text-gray-900'}`}>
                      Request custom plan
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      More than 25 tables or a negotiated rate — we confirm pricing, then you pay in-app.
                    </p>
                  </button>
                </div>

                {/* Trial: feature list */}
                {startMode === 'trial' && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">What's included</p>
                    <ul className="mt-3 space-y-2">
                      {TRIAL_INCLUDES.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Paid: full plan picker */}
                {startMode === 'paid' && (
                  <PlanStep subscription={subscription} onChange={setSubscription} cityTier={cityTier} />
                )}

                {startMode === 'custom_request' && (
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-600">
                      Tell us the capacity you need. BillGenie will set a negotiated price — payment opens in the app after that.
                    </p>
                    <label className="block text-sm text-gray-800">
                      Tables needed (26–200)
                      <input
                        type="number"
                        min={26}
                        max={200}
                        value={customRequest.max_tables}
                        onChange={(e) =>
                          setCustomRequest((p) => ({
                            ...p,
                            max_tables: Math.min(200, Math.max(26, Number(e.target.value) || 26)),
                          }))
                        }
                        className={inputCls}
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['extra_staff', 'Extra staff'],
                          ['extra_chefs', 'Extra chefs'],
                          ['extra_managers', 'Extra managers'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block text-xs text-gray-700">
                          {label}
                          <input
                            type="number"
                            min={0}
                            value={customRequest[key]}
                            onChange={(e) =>
                              setCustomRequest((p) => ({ ...p, [key]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                            className={inputCls}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                      {(
                        [
                          ['inventory', 'Inventory'],
                          ['expenses', 'Expenses'],
                          ['history_extended', 'Extended history'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={customRequest[key]}
                            onChange={() => setCustomRequest((p) => ({ ...p, [key]: !p[key] }))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="block text-sm text-gray-800">
                      Notes (optional)
                      <textarea
                        rows={3}
                        value={customRequest.notes}
                        onChange={(e) => setCustomRequest((p) => ({ ...p, notes: e.target.value }))}
                        className={inputCls}
                        placeholder="Locations, peak covers, special needs…"
                      />
                    </label>
                  </div>
                )}

                <NavButtons onBack={goBack} onNext={goNext} nextLabel="Next: Security" />
              </div>
            )}

            {/* ── Step 3: Security (login number + password) ── */}
            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Login number */}
                <div>
                  <p className="text-sm font-medium text-gray-900">Your admin login number</p>
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <span className="flex-1 font-mono text-xl font-extrabold tracking-widest text-primary">
                      {loginId}
                    </span>
                    <button
                      type="button"
                      onClick={copyLoginId}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
                    >
                      {copied ? <><CheckCircle2 size={13} />Copied</> : <><Copy size={13} />Copy</>}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    This is your admin login number — save it. You will use it with your password every time you log in. Email and phone are only for password recovery.
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label className={labelCls}>Create password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputCls + ' pr-10'}
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Confirm password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputCls + ' pr-10'}
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBox>{error}</ErrorBox>}

                <p className="text-center text-xs text-gray-500">
                  By creating an account, you agree to our{' '}
                  <Link to="/terms" className="font-medium text-primary hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="font-medium text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <><Loader2 size={15} className="animate-spin" />Creating…</> : 'Create account'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
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

// ── Small helpers ─────────────────────────────────────────────────────────────

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Next',
  className = '',
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-3 pt-1 ${className}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
        >
          Back
        </button>
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className={`rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark ${onBack ? 'flex-1' : 'w-full'}`}
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
