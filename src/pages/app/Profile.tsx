import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient, type RestaurantProfile } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectProfile, setProfile, updateProfile } from '../../store/profileSlice';
import { isValidUpiId } from '../../lib/upiPayment';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileForm {
  name: string;
  address: string;
  city: string;
  cuisine: string;
  contact_number: string;
  upi_id: string;
  is_self_service: boolean;
  counter_service_modes: 'both' | 'eat_here' | 'takeaway' | '';
}

function profileToForm(p: RestaurantProfile): ProfileForm {
  return {
    name: p.name ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    cuisine: p.cuisine ?? '',
    contact_number: p.contact_number ?? '',
    upi_id: p.upi_id ?? '',
    is_self_service: p.is_self_service ?? false,
    counter_service_modes: p.counter_service_modes ?? '',
  };
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}

function Field({ label, optional, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {optional && (
          <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}

function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          checked ? 'bg-primary' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Counter Service Mode Radio ───────────────────────────────────────────────

type ServiceMode = 'both' | 'eat_here' | 'takeaway';

const SERVICE_MODE_OPTIONS: { value: ServiceMode; label: string }[] = [
  { value: 'eat_here', label: 'Eat here' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'both', label: 'Both' },
];

interface ServiceModeRadioProps {
  value: ServiceMode | '';
  onChange: (v: ServiceMode) => void;
}

function ServiceModeRadio({ value, onChange }: ServiceModeRadioProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {SERVICE_MODE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            value === opt.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            className="sr-only"
            name="counter_service_mode"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Profile() {
  const dispatch = useAppDispatch();
  const storedProfile = useAppSelector(selectProfile);

  const [form, setForm] = useState<ProfileForm>({
    name: '',
    address: '',
    city: '',
    cuisine: '',
    contact_number: '',
    upi_id: '',
    is_self_service: false,
    counter_service_modes: '',
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const upiTouched = form.upi_id.length > 0;
  const upiValid = upiTouched && isValidUpiId(form.upi_id);
  const upiInvalid = upiTouched && !upiValid;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.getRestaurantProfile();
      dispatch(setProfile(data));
      setForm(profileToForm(data));
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    // Use Redux cache if already hydrated, but still fetch to keep fresh
    if (storedProfile) {
      setForm(profileToForm(storedProfile));
      setLoading(false);
    }
    loadProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccessMsg(null);
    setSaveError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSuccessMsg(null);
    try {
      const payload = {
        name: form.name.trim() || undefined,
        address: form.address.trim() || undefined,
        contact_number: form.contact_number.trim() || undefined,
        upi_id: form.upi_id.trim() || undefined,
        is_self_service: form.is_self_service,
        counter_service_modes:
          form.counter_service_modes !== ''
            ? (form.counter_service_modes as 'both' | 'eat_here' | 'takeaway')
            : undefined,
      };
      const { restaurant } = await apiClient.updateRestaurantProfile(payload);
      dispatch(updateProfile(restaurant));
      setSuccessMsg('Profile saved successfully.');
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save profile.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !storedProfile) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (loadError && !storedProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Restaurant Profile" />
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError}
          <button
            onClick={loadProfile}
            className="ml-3 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Profile"
        subtitle="Manage your restaurant's public information and settings"
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Restaurant Info */}
        <SectionCard title="Restaurant Info">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Restaurant name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Spice Garden"
                className={inputClass}
              />
            </Field>
            <Field label="Contact number">
              <input
                type="tel"
                value={form.contact_number}
                onChange={(e) => set('contact_number', e.target.value)}
                placeholder="+91 00000 00000"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="Street address"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="e.g. Mumbai"
                className={inputClass}
              />
            </Field>
            <Field label="Cuisine type" optional>
              <input
                type="text"
                value={form.cuisine}
                onChange={(e) => set('cuisine', e.target.value)}
                placeholder="e.g. Indian, Chinese"
                className={inputClass}
              />
            </Field>
          </div>
        </SectionCard>

        {/* Section 2: Payment */}
        <SectionCard title="Payment">
          <Field label="UPI ID" optional>
            <div className="relative">
              <input
                type="text"
                value={form.upi_id}
                onChange={(e) => set('upi_id', e.target.value)}
                placeholder="yourname@upi"
                className={`${inputClass} pr-9 ${
                  upiInvalid
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-200'
                    : upiValid
                    ? 'border-green-400 focus:border-green-400 focus:ring-green-200'
                    : ''
                }`}
              />
              {upiTouched && (
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  {upiValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
            {upiInvalid ? (
              <p className="mt-1 text-xs text-red-500">
                Enter a valid UPI ID (e.g. yourname@upi)
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                Enter your UPI ID to accept UPI payments
              </p>
            )}
          </Field>
        </SectionCard>

        {/* Section 3: Service Mode */}
        <SectionCard title="Service Mode">
          <Toggle
            checked={form.is_self_service}
            onChange={(v) => set('is_self_service', v)}
            label="Self-service QR ordering"
            description="Customers can scan a QR code to place their own orders"
          />
          <div className="border-t border-gray-100 pt-4">
            <Field label="Counter service mode">
              <ServiceModeRadio
                value={form.counter_service_modes}
                onChange={(v) => set('counter_service_modes', v)}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Choose which order types are available at the counter
              </p>
            </Field>
          </div>
        </SectionCard>

        {/* Feedback messages */}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {saveError}
          </div>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
