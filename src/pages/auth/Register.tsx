import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Loader2, ChevronLeft } from 'lucide-react';
import { apiClient, type AccountInvitePreview } from '../../services/api';
import {
  BILLING_CYCLE_OPTIONS,
  billingCycleLabel,
  type BillingCycle,
} from '../../data/pricing';
import { INDIA_LOCATION_OPTIONS, citiesForState } from '../../data/indiaLocations';

type RegisterPath = 'chooser' | 'request' | 'request_done' | 'complete';

export function Register() {
  const navigate = useNavigate();
  const [path, setPath] = useState<RegisterPath>('chooser');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [reqName, setReqName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqRestaurant, setReqRestaurant] = useState('');
  const [reqAddress, setReqAddress] = useState('');
  const [reqCity, setReqCity] = useState('');
  const [reqState, setReqState] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [assignedLoginId, setAssignedLoginId] = useState('');

  const [loginId, setLoginId] = useState('');
  const [registerToken, setRegisterToken] = useState('');
  const [preview, setPreview] = useState<AccountInvitePreview | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('quarterly');
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [cuisine, setCuisine] = useState('');

  const cityOptions = useMemo(() => citiesForState(state || reqState), [state, reqState]);
  const cycleAmount = preview?.cycle_prices?.[billingCycle] ?? 0;

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reqName.trim() || !reqPhone.trim() || !reqRestaurant.trim() || !reqAddress.trim()) {
      setError('Name, phone, restaurant, and address are required');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.submitAccountRequest({
        name: reqName.trim(),
        phone: reqPhone.trim(),
        restaurant_name: reqRestaurant.trim(),
        address: reqAddress.trim(),
        city: reqCity.trim() || undefined,
        state: reqState.trim() || undefined,
        notes: reqNotes.trim() || undefined,
        source: 'web',
      });
      setAssignedLoginId(res.login_id);
      setPath('request_done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit request');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!loginId.trim() || !registerToken.trim()) {
      setError('Enter your login ID and register token');
      return;
    }
    setLoading(true);
    try {
      const invite = await apiClient.previewAccountInvite(loginId.trim(), registerToken.trim());
      setPreview(invite);
      setRestaurantName(invite.restaurant_name || '');
      setOwnerName(invite.name || '');
      setPhone(invite.phone || '');
      setAddress(invite.address || '');
      setCity(invite.city || '');
      setState(invite.state || '');
      setBillingCycle('quarterly');
    } catch (err: unknown) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Invalid login ID or token');
    } finally {
      setLoading(false);
    }
  }

  async function completeRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!preview) {
      setError('Verify your login ID and token first');
      return;
    }
    if (!restaurantName.trim() || !ownerName.trim() || !email.trim() || !phone.trim()) {
      setError('Restaurant, owner, email, and phone are required');
      return;
    }
    if (!state.trim() || !city.trim()) {
      setError('State and city are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.register({
        login_id: loginId.trim(),
        register_token: registerToken.trim(),
        billing_cycle: billingCycle,
        restaurant_name: restaurantName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        address: address.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        cuisine: cuisine.trim() || undefined,
      });
      navigate('/login', {
        replace: true,
        state: {
          message:
            response.message ||
            `Restaurant created. Verify ${response.email}, then sign in with login ${response.login_id} and complete payment.`,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  const labelClass = 'block text-xs font-semibold text-gray-600';

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-gray-900">Get started with BillGenie</h1>
        <p className="mt-2 text-sm text-gray-500">
          Request an account, get a login ID, then register with your one-time token after pricing.
        </p>
      </div>

      {path === 'chooser' ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setPath('request')}
            className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left hover:border-primary/40"
          >
            <p className="font-bold text-gray-900">1. Request an account</p>
            <p className="mt-1 text-sm text-gray-500">
              Share your details. We reserve your login ID and contact you to set deal pricing.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setPath('complete')}
            className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left hover:border-primary/40"
          >
            <p className="font-bold text-gray-900">2. Complete registration</p>
            <p className="mt-1 text-sm text-gray-500">
              Already have a login ID and register token? Finish setup and pay to activate.
            </p>
          </button>
        </div>
      ) : null}

      {path === 'request' ? (
        <form onSubmit={submitRequest} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5">
          <button type="button" onClick={() => setPath('chooser')} className="mb-2 flex items-center gap-1 text-sm text-primary">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <label className={labelClass}>
            Your name
            <input className={fieldClass} value={reqName} onChange={(e) => setReqName(e.target.value)} />
          </label>
          <label className={labelClass}>
            Phone
            <input className={fieldClass} value={reqPhone} onChange={(e) => setReqPhone(e.target.value)} />
          </label>
          <label className={labelClass}>
            Restaurant name
            <input className={fieldClass} value={reqRestaurant} onChange={(e) => setReqRestaurant(e.target.value)} />
          </label>
          <label className={labelClass}>
            Address
            <input className={fieldClass} value={reqAddress} onChange={(e) => setReqAddress(e.target.value)} />
          </label>
          <label className={labelClass}>
            State
            <select
              className={fieldClass}
              value={reqState}
              onChange={(e) => {
                setReqState(e.target.value);
                setReqCity('');
              }}
            >
              <option value="">Select state</option>
              {INDIA_LOCATION_OPTIONS.map((o) => (
                <option key={o.state} value={o.state}>
                  {o.state}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            City
            <select className={fieldClass} value={reqCity} onChange={(e) => setReqCity(e.target.value)}>
              <option value="">Select city</option>
              {citiesForState(reqState).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Notes (optional)
            <textarea className={fieldClass} rows={3} value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Request account
          </button>
        </form>
      ) : null}

      {path === 'request_done' ? (
        <div className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="text-lg font-bold text-gray-900">Account requested</h2>
          <p className="text-sm text-gray-600">
            Save this login ID. BillGenie will contact you and share a register token after pricing.
          </p>
          <p className="font-mono text-3xl font-extrabold tracking-wide text-primary">{assignedLoginId}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(assignedLoginId).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy login ID'}
          </button>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setLoginId(assignedLoginId);
                setPath('complete');
              }}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white"
            >
              I have a register token
            </button>
            <Link to="/login" className="text-sm font-semibold text-primary">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : null}

      {path === 'complete' ? (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <button type="button" onClick={() => setPath('chooser')} className="flex items-center gap-1 text-sm text-primary">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <form onSubmit={loadPreview} className="space-y-3">
            <label className={labelClass}>
              Login ID
              <input className={fieldClass} value={loginId} onChange={(e) => setLoginId(e.target.value)} />
            </label>
            <label className={labelClass}>
              Register token
              <input className={fieldClass} value={registerToken} onChange={(e) => setRegisterToken(e.target.value)} />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {loading && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify invite
            </button>
          </form>

          {preview ? (
            <form onSubmit={completeRegister} className="space-y-3 border-t border-gray-100 pt-4">
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-semibold">{preview.restaurant_name}</p>
                <p className="mt-1 text-gray-500">
                  ₹{preview.monthly_price.toLocaleString('en-IN')}/mo · {preview.max_tables} tables (excl. GST)
                </p>
              </div>
              <p className={labelClass}>Billing cycle</p>
              <div className="grid grid-cols-3 gap-2">
                {BILLING_CYCLE_OPTIONS.map((cycle) => {
                  const amount = preview.cycle_prices?.[cycle.id] ?? 0;
                  const active = billingCycle === cycle.id;
                  return (
                    <button
                      key={cycle.id}
                      type="button"
                      onClick={() => setBillingCycle(cycle.id)}
                      className={`rounded-xl border px-2 py-3 text-center ${
                        active ? 'border-primary bg-primary/5' : 'border-gray-200'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-800">{cycle.shortLabel}</p>
                      <p className="mt-1 text-xs font-bold text-primary">₹{amount.toLocaleString('en-IN')}</p>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Selected: {billingCycleLabel(billingCycle)} · ₹{cycleAmount.toLocaleString('en-IN')} excl. GST
              </p>

              <label className={labelClass}>
                Restaurant name
                <input className={fieldClass} value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
              </label>
              <label className={labelClass}>
                Address
                <input className={fieldClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label className={labelClass}>
                State
                <select
                  className={fieldClass}
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setCity('');
                  }}
                >
                  <option value="">Select state</option>
                  {INDIA_LOCATION_OPTIONS.map((o) => (
                    <option key={o.state} value={o.state}>
                      {o.state}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                City
                <select className={fieldClass} value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Select city</option>
                  {cityOptions.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Cuisine (optional)
                <input className={fieldClass} value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
              </label>
              <label className={labelClass}>
                Owner name
                <input className={fieldClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </label>
              <label className={labelClass}>
                Email
                <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className={labelClass}>
                Phone
                <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className={labelClass}>
                Password
                <input className={fieldClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className={labelClass}>
                Confirm password
                <input
                  className={fieldClass}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create restaurant & continue
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </div>
  );
}
