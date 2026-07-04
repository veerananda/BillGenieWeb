import { useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, CheckCircle2, Loader2, Minus, Plus, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../../services/api';
import { wsService } from '../../services/websocket';
import { setAuth } from '../../store/authSlice';
import { useAppDispatch } from '../../store/hooks';
import {
  ADDON_OPTIONS,
  BASIC_FEATURES,
  BASIC_MONTHLY_PRICE,
  PRICING,
  INCLUDED_TABLES_BASIC,
  MIN_TABLES_DINE_IN,
  MAX_TABLES,
  TABLE_STAFF_BUNDLE_SIZE,
  formatInr,
  calculateSubscriptionQuote,
  bundledStaffFromTables,
  bundledManagersFromTables,
  DEFAULT_SUBSCRIPTION_SELECTION,
  type SubscriptionSelection,
  type OperationMode,
  type BillingCycle,
} from '../../data/pricing';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateLoginId(): string {
  const suffix = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `100${suffix}`;
}

// ── Step types ────────────────────────────────────────────────────────────────

interface Step1 { restaurantName: string; cuisine: string; city: string; address: string; }
interface Step2 { ownerName: string; email: string; phone: string; }

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

// ── Numeric stepper widget ────────────────────────────────────────────────────

function NumericStepper({
  label,
  subtitle,
  value,
  min = 0,
  max = 20,
  onChange,
}: {
  label: string;
  subtitle: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 pr-4">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition"
        >
          <Minus size={14} />
        </button>
        <span className="w-6 text-center text-base font-bold text-gray-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Table capacity stepper ────────────────────────────────────────────────────

function TableCapacityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const tables = value || INCLUDED_TABLES_BASIC;
  const staffIncluded = bundledStaffFromTables(tables);
  const managersIncluded = bundledManagersFromTables(tables);

  const stepDown = () => {
    if (tables <= INCLUDED_TABLES_BASIC) {
      onChange(Math.max(MIN_TABLES_DINE_IN, tables - TABLE_STAFF_BUNDLE_SIZE));
    } else {
      onChange(Math.max(INCLUDED_TABLES_BASIC, tables - TABLE_STAFF_BUNDLE_SIZE));
    }
  };
  const stepUp = () => onChange(Math.min(MAX_TABLES, tables + TABLE_STAFF_BUNDLE_SIZE));

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-4">
        <div className="text-sm font-medium text-gray-900">Max dine-in tables</div>
        <div className="mt-1 text-xs text-gray-500 leading-5">
          {INCLUDED_TABLES_BASIC} included in basic. Each +{TABLE_STAFF_BUNDLE_SIZE} tables adds 1 staff ({formatInr(PRICING.table_staff_bundle)}/mo).<br />
          Includes {staffIncluded} staff · {managersIncluded} manager{managersIncluded === 1 ? '' : 's'} (1 per 15 tables).
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={stepDown}
          disabled={tables <= MIN_TABLES_DINE_IN}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition"
        >
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-base font-bold text-gray-900">{tables}</span>
        <button
          type="button"
          onClick={stepUp}
          disabled={tables >= MAX_TABLES}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Plan step component ───────────────────────────────────────────────────────

function PlanStep({
  subscription,
  onChange,
}: {
  subscription: SubscriptionSelection;
  onChange: (s: SubscriptionSelection) => void;
}) {
  const quote = useMemo(() => calculateSubscriptionQuote(subscription), [subscription]);

  function setMode(mode: OperationMode) {
    onChange({
      ...subscription,
      operation_mode: mode,
      max_tables:
        mode === 'counter' ? 0 : Math.max(subscription.max_tables || INCLUDED_TABLES_BASIC, MIN_TABLES_DINE_IN),
      kitchen_dine_in: mode === 'counter' ? false : subscription.kitchen_dine_in,
      kitchen_counter: mode === 'dine_in' ? false : subscription.kitchen_counter,
    });
  }

  function setCycle(billing_cycle: BillingCycle) {
    onChange({ ...subscription, billing_cycle });
  }

  function toggleAddon(key: keyof Pick<SubscriptionSelection, 'history_extended' | 'inventory' | 'kitchen_dine_in' | 'kitchen_counter'>) {
    onChange({ ...subscription, [key]: !subscription[key] });
  }

  const displayTotal =
    subscription.billing_cycle === 'annual'
      ? `${formatInr(quote.annual_total)}/year`
      : `${formatInr(quote.monthly_subtotal)}/month`;

  const visibleAddons = ADDON_OPTIONS.filter(
    (a) => !a.onlyFor || a.onlyFor.includes(subscription.operation_mode)
  );

  return (
    <div className="space-y-6">
      {/* Basic plan */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Basic plan</p>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-gray-900">Basic</span>
            <span className="text-base font-bold text-gray-900">{formatInr(BASIC_MONTHLY_PRICE)}<span className="text-xs font-normal text-gray-500">/mo</span></span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Includes after 30-day free trial:</p>
          <ul className="mt-2 space-y-1">
            {BASIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Service mode */}
      <div>
        <p className="text-sm font-semibold text-gray-900">Service mode</p>
        <p className="mt-0.5 text-xs text-gray-500">Basic includes one mode. Both adds dine-in + counter.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {([
            ['dine_in', 'Dine-in only'],
            ['counter', 'Counter only'],
            ['both', `Both (+${formatInr(PRICING.dual_service)})`],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                subscription.operation_mode === mode
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table capacity */}
      {subscription.operation_mode !== 'counter' && (
        <div>
          <p className="text-sm font-semibold text-gray-900">Table capacity &amp; team</p>
          <p className="mt-0.5 text-xs text-gray-500">Staff and manager seats are included automatically from your table count.</p>
          <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <TableCapacityStepper
              value={subscription.max_tables || INCLUDED_TABLES_BASIC}
              onChange={(max_tables) => onChange({ ...subscription, max_tables })}
            />
          </div>
        </div>
      )}

      {/* Extra team */}
      <div>
        <p className="text-sm font-semibold text-gray-900">Extra team <span className="text-xs font-normal text-gray-500">(optional)</span></p>
        <p className="mt-0.5 text-xs text-gray-500">Add seats beyond what your table bundles already include.</p>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-4">
          <NumericStepper
            label="Additional staff"
            subtitle={`${formatInr(PRICING.extra_staff)} / month each`}
            value={subscription.extra_staff}
            onChange={(extra_staff) => onChange({ ...subscription, extra_staff })}
          />
          <NumericStepper
            label="Additional managers"
            subtitle={`${formatInr(PRICING.extra_manager)} / month each`}
            value={subscription.extra_managers}
            max={10}
            onChange={(extra_managers) => onChange({ ...subscription, extra_managers })}
          />
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <p className="text-sm font-semibold text-gray-900">Optional add-ons</p>
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 divide-y divide-gray-100">
          {visibleAddons.map((addon) => {
            const checked = subscription[addon.key];
            return (
              <button
                key={addon.key}
                type="button"
                onClick={() => toggleAddon(addon.key)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-100 transition"
              >
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${checked ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
                  {checked && <Check size={11} strokeWidth={3} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900">{addon.title}</span>
                    <span className="shrink-0 text-xs font-semibold text-primary">+{formatInr(addon.price)}/mo</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{addon.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Billing cycle */}
      <div>
        <p className="text-sm font-semibold text-gray-900">Billing</p>
        <div className="mt-2 flex gap-2">
          {([
            ['monthly', 'Monthly'],
            ['annual', 'Annual (2 months free)'],
          ] as const).map(([cycle, label]) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setCycle(cycle)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                subscription.billing_cycle === cycle
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Total card */}
      <div className="rounded-xl bg-primary/8 border border-primary/20 p-4">
        <p className="text-xs text-gray-600">
          {subscription.billing_cycle === 'annual' ? 'Estimated after trial' : 'Estimated monthly (excl. 18% GST)'}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-primary">{displayTotal}</p>
        {subscription.operation_mode !== 'counter' && (
          <p className="mt-1 text-xs text-gray-600">
            Plan includes {quote.bundled_staff} staff and {quote.bundled_managers} manager{quote.bundled_managers === 1 ? '' : 's'} for {quote.selection.max_tables} tables.
          </p>
        )}
        {subscription.billing_cycle === 'annual' ? (
          <p className="mt-1 text-xs text-gray-500">
            ≈ {formatInr(quote.annual_monthly_equivalent)}/mo · Save {formatInr(quote.annual_savings)} vs monthly
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-500">30-day free trial · prices sum as you select features</p>
        )}
        <div className="mt-2 space-y-0.5">
          {quote.line_items.filter((li) => li.amount > 0).map((li) => (
            <div key={li.id} className="flex justify-between text-xs text-gray-500">
              <span>{li.label}</span>
              <span>{formatInr(li.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Register() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [step1, setStep1] = useState<Step1>({ restaurantName: '', cuisine: '', city: '', address: '' });
  const [step2, setStep2] = useState<Step2>({ ownerName: '', email: '', phone: '' });
  const [subscription, setSubscription] = useState<SubscriptionSelection>(DEFAULT_SUBSCRIPTION_SELECTION);
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

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (step === 0) {
      if (!step1.restaurantName.trim()) return 'Restaurant name is required.';
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
        city: step1.city.trim() || undefined,
        address: step1.address.trim() || undefined,
        owner_name: step2.ownerName.trim(),
        email: step2.email.trim(),
        phone: step2.phone.trim(),
        login_id: loginId,
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

  const inputCls = 'mt-1.5 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition';
  const labelCls = 'block text-sm font-medium text-gray-900';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">

          {/* Logo */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-md">
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">BillGenie</span>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="mt-1 text-sm text-gray-500">30-day free trial — no credit card required</p>
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
                  <label className={labelCls}>City <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                  <input type="text" placeholder="e.g. Mumbai" value={step1.city} onChange={s1('city')} className={inputCls} />
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
              <div className="space-y-0">
                <PlanStep subscription={subscription} onChange={setSubscription} />
                <NavButtons onBack={goBack} onNext={goNext} nextLabel="Next: Security" className="mt-6" />
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
