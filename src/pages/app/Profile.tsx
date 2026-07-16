import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Calendar,
  Camera,
  CreditCard,
} from 'lucide-react';
import { apiClient, type RestaurantTable, type RestaurantProfile } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectProfile, setProfile, updateProfile } from '../../store/profileSlice';
import { isValidUpiId } from '../../lib/upiPayment';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import {
  DEFAULT_SUBSCRIPTION_SELECTION,
  formatSubscriptionPlanName,
  type SubscriptionSelection,
} from '../../data/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileForm {
  name: string;
  address: string;
  city: string;
  cuisine: string;
  contact_number: string;
  upi_id: string;
  upi_qr_code: string;
  is_self_service: boolean;
  counter_service_modes: 'both' | 'eat_here' | 'takeaway' | '';
  prices_include_gst: boolean;
}

function profileToForm(p: RestaurantProfile): ProfileForm {
  return {
    name: p.name ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    cuisine: p.cuisine ?? '',
    contact_number: p.contact_number ?? '',
    upi_id: p.upi_id ?? '',
    upi_qr_code: p.upi_qr_code ?? '',
    is_self_service: p.is_self_service ?? false,
    counter_service_modes: p.counter_service_modes ?? '',
    prices_include_gst: p.prices_include_gst ?? false,
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${day} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function getDaysRemaining(dateStr: string): number {
  const end = new Date(dateStr);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getSubscriptionSelection(profile: RestaurantProfile | null): SubscriptionSelection | null {
  const selection = profile?.subscription_selection as SubscriptionSelection | undefined;
  if (selection?.operation_mode) {
    return { ...DEFAULT_SUBSCRIPTION_SELECTION, ...selection };
  }

  const config = profile?.subscription_config as { selection?: SubscriptionSelection } | undefined;
  if (config?.selection?.operation_mode) {
    return { ...DEFAULT_SUBSCRIPTION_SELECTION, ...config.selection };
  }

  return null;
}

function getPlanDisplayName(profile: RestaurantProfile | null): string {
  const plan = String(profile?.subscription_plan || '').toLowerCase();
  if (plan === 'trial') {
    return 'BillGenie Trial';
  }
  if (plan === 'customised' || plan === 'customized') {
    return 'BillGenie Customised';
  }

  const selection = getSubscriptionSelection(profile);
  if (selection) {
    return formatSubscriptionPlanName(selection, { phase: profile?.subscription_phase });
  }

  return `BillGenie ${capitalize(profile?.subscription_plan ?? 'Basic')}`;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
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

// ─── Subscription Info Card ───────────────────────────────────────────────────

function SubscriptionInfoCard({ profile }: { profile: RestaurantProfile | null }) {
  const limits = profile?.subscription_limits;
  const usage = profile?.subscription_usage;
  const planName = getPlanDisplayName(profile);
  const subEnd = profile?.subscription_end;
  const daysLeft = subEnd ? getDaysRemaining(subEnd) : null;
  const monthlyPrice = profile?.subscription_monthly_price?.toLocaleString('en-IN') ?? '799';

  const daysColor =
    daysLeft === null
      ? 'text-gray-500'
      : daysLeft <= 7
      ? 'text-red-600'
      : 'text-green-600';

  const serviceType = limits
    ? limits.dine_in_enabled && limits.counter_enabled
      ? 'Dine-in + Counter'
      : limits.dine_in_enabled
      ? 'Dine-in'
      : limits.counter_enabled
      ? 'Counter'
      : 'None'
    : '—';

  const planRows = limits
    ? [
        { label: 'Service', value: serviceType },
        {
          label: 'Tables',
          value: usage
            ? `${usage.tables} / ${limits.max_tables}`
            : String(limits.max_tables),
        },
        {
          label: 'Staff',
          value: usage
            ? `${usage.staff_and_chefs} / ${limits.max_staff_and_chefs}`
            : String(limits.max_staff_and_chefs),
        },
        {
          label: 'Managers',
          value: usage
            ? `${usage.managers} / ${limits.max_managers}`
            : String(limits.max_managers),
        },
        { label: 'History', value: limits.history_days === 730 ? '2 years' : '30 days' },
      ]
    : [];

  const addonRows = limits
    ? [
        { label: 'Kitchen (dine-in)', enabled: limits.kitchen_dine_in },
        { label: 'Kitchen (counter)', enabled: limits.kitchen_counter },
        { label: 'Inventory', enabled: limits.inventory },
        { label: 'Extended history', enabled: limits.history_days === 730 },
      ]
    : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-primary">Subscription Status</h2>
        </div>
      </div>

      {!limits ? (
        <div className="px-6 py-5 space-y-3 animate-pulse">
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-2/5 rounded bg-gray-200" />
          <p className="text-xs text-gray-400 pt-1 animate-none">Loading plan details...</p>
        </div>
      ) : (
        <div className="px-6 py-5 space-y-5">
          {/* Plan & billing */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {planName}
                <span className="ml-1.5 text-sm font-normal text-gray-500">
                  (₹{monthlyPrice}/month)
                </span>
              </p>
            </div>
            {subEnd && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end text-xs text-gray-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Renews {formatDate(subEnd)}</span>
                </div>
                {daysLeft !== null && (
                  <p className={`mt-0.5 text-sm font-semibold ${daysColor}`}>
                    {daysLeft > 0 ? `${daysLeft} days remaining` : 'Expired'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Your plan includes */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Your plan includes:
            </p>
            <div className="space-y-1.5">
              {planRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-gray-800">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Add-ons
            </p>
            <div className="space-y-1.5">
              {addonRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span
                    className={`font-medium ${
                      row.enabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {row.enabled ? 'Included' : 'Not included'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Profile() {
  const dispatch = useAppDispatch();
  const storedProfile = useAppSelector(selectProfile);

  // ── Refs ──────────────────────────────────────────────────────────────────

  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Profile form state ────────────────────────────────────────────────────

  const [form, setForm] = useState<ProfileForm>({
    name: '',
    address: '',
    city: '',
    cuisine: '',
    contact_number: '',
    upi_id: '',
    upi_qr_code: '',
    is_self_service: false,
    counter_service_modes: '',
    prices_include_gst: false,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Tables state ──────────────────────────────────────────────────────────

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);

  // Unified add/edit modal
  const [tableModalMode, setTableModalMode] = useState<'add' | 'edit' | null>(null);
  const [tableModalTarget, setTableModalTarget] = useState<RestaurantTable | null>(null);
  const [tableModalName, setTableModalName] = useState('');
  const [tableModalCapacity, setTableModalCapacity] = useState('');
  const [tableModalSaving, setTableModalSaving] = useState(false);
  const [tableModalError, setTableModalError] = useState<string | null>(null);

  // ── Derived values ────────────────────────────────────────────────────────

  const upiTouched = form.upi_id.length > 0;
  const upiValid = upiTouched && isValidUpiId(form.upi_id);
  const upiInvalid = upiTouched && !upiValid;

  const maxTables = storedProfile?.subscription_limits?.max_tables ?? 10;
  const tableCount = tables.length;
  const atTableLimit = tableCount >= maxTables;

  // ── Data loaders ──────────────────────────────────────────────────────────

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

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError(null);
    try {
      const data = await apiClient.getTables();
      setTables(data);
    } catch (err: unknown) {
      setTablesError(
        err instanceof Error ? err.message : 'Failed to load tables.'
      );
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Use Redux cache if already hydrated, but still fetch to keep fresh
    if (storedProfile) {
      setForm(profileToForm(storedProfile));
      setLoading(false);
    }
    loadProfile();
    loadTables();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form field helper ─────────────────────────────────────────────────────

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccessMsg(null);
    setSaveError(null);
  }

  // ── Profile save ──────────────────────────────────────────────────────────

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
        upi_qr_code: form.upi_qr_code || undefined,
        is_self_service: form.is_self_service,
        counter_service_modes:
          form.counter_service_modes !== ''
            ? (form.counter_service_modes as 'both' | 'eat_here' | 'takeaway')
            : undefined,
        prices_include_gst: form.prices_include_gst,
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

  // ── Table modal handlers ──────────────────────────────────────────────────

  function openAddTableModal() {
    setTableModalMode('add');
    setTableModalTarget(null);
    setTableModalName('');
    setTableModalCapacity('');
    setTableModalError(null);
  }

  function openEditTableModal(table: RestaurantTable) {
    setTableModalMode('edit');
    setTableModalTarget(table);
    setTableModalName(table.name);
    setTableModalCapacity(table.capacity ? String(table.capacity) : '');
    setTableModalError(null);
  }

  function closeTableModal() {
    setTableModalMode(null);
    setTableModalTarget(null);
    setTableModalName('');
    setTableModalCapacity('');
    setTableModalError(null);
  }

  async function handleTableModalSave() {
    const name = tableModalName.trim();
    if (!name) {
      setTableModalError('Table name is required.');
      return;
    }
    if (name.length > 7) {
      setTableModalError('Table name must be 7 characters or less.');
      return;
    }
    setTableModalSaving(true);
    setTableModalError(null);
    try {
      if (tableModalMode === 'add') {
        const table = await apiClient.createTable(name);
        const cap = tableModalCapacity ? parseInt(tableModalCapacity) : undefined;
        let finalTable = table;
        if (cap && cap >= 1) {
          finalTable = await apiClient.updateTable(table.id, { capacity: cap });
        }
        setTables((prev) => [...prev, finalTable]);
        closeTableModal();
      } else if (tableModalMode === 'edit' && tableModalTarget) {
        const cap = tableModalCapacity ? parseInt(tableModalCapacity) : undefined;
        const updates: { name?: string; capacity?: number } = { name };
        if (cap && cap >= 1) updates.capacity = cap;
        const updated = await apiClient.updateTable(tableModalTarget.id, updates);
        setTables((prev) =>
          prev.map((t) => (t.id === tableModalTarget.id ? updated : t))
        );
        closeTableModal();
      }
    } catch (err: unknown) {
      setTableModalError(
        err instanceof Error ? err.message : 'Failed to save table.'
      );
    } finally {
      setTableModalSaving(false);
    }
  }

  async function handleDeleteTableFromModal() {
    if (!tableModalTarget) return;
    if (
      !window.confirm(
        `Delete table "${tableModalTarget.name}"? This cannot be undone.`
      )
    )
      return;
    setTableModalSaving(true);
    setTableModalError(null);
    try {
      await apiClient.deleteTable(tableModalTarget.id);
      setTables((prev) => prev.filter((t) => t.id !== tableModalTarget.id));
      closeTableModal();
    } catch (err: unknown) {
      setTableModalError(
        err instanceof Error ? err.message : 'Failed to delete table.'
      );
      setTableModalSaving(false);
    }
  }

  // ── Early returns ─────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurant Profile"
        subtitle="Manage your restaurant's public information and settings"
      />

      {/* Section 0: Subscription (shown first, before the form) */}
      <SubscriptionInfoCard profile={storedProfile} />

      {/* Profile form — id lets the external save button bind to it */}
      <form id="profile-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Restaurant Info */}
        <SectionCard title="Restaurant Info">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Restaurant Name *">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="e.g. Spice Garden"
                className={inputClass}
              />
            </Field>
            <Field label="Phone Number">
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

        {/* Section 2: Tables */}
        <SectionCard
          title="Tables"
          subtitle={`${tableCount} / ${maxTables} tables`}
        >
          {/* Error banner */}
          {tablesError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{tablesError}</span>
              <button
                type="button"
                onClick={loadTables}
                className="ml-1 font-semibold underline underline-offset-2 shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading state */}
          {tablesLoading && tables.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" className="text-primary" />
            </div>
          )}

          {/* Add New Table button */}
          <button
            type="button"
            onClick={openAddTableModal}
            disabled={atTableLimit || tablesLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {atTableLimit ? `Table limit reached (${maxTables} max)` : 'Add New Table'}
          </button>

          {/* Tables grid */}
          {tables.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">
                Existing Tables ({tables.length}) — tap to edit
              </p>
              <div className="flex flex-wrap gap-2">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => openEditTableModal(table)}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                  >
                    {table.name}
                    {table.capacity ? (
                      <span className="ml-1 text-xs font-normal opacity-80">
                        ({table.capacity})
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!tablesLoading && tables.length === 0 && !tablesError && (
            <p className="py-2 text-center text-sm text-gray-400">
              No tables yet. Add your first table above.
            </p>
          )}
        </SectionCard>

        {/* Section 3: Billing & Tax */}
        <SectionCard
          title="Billing & Tax"
          subtitle="Controls how GST is shown on customer bills"
        >
          <Toggle
            checked={form.prices_include_gst}
            onChange={(v) => set('prices_include_gst', v)}
            label="Menu prices include GST"
            description={
              form.prices_include_gst
                ? 'Example: ₹105 on menu → taxable ₹100 + GST ₹5'
                : 'Example: ₹100 on menu + GST ₹5 = ₹105 total'
            }
          />
        </SectionCard>

        {/* Section 4: Ordering Settings */}
        <SectionCard title="Ordering Settings">
          <Toggle
            checked={form.is_self_service}
            onChange={(v) => set('is_self_service', v)}
            label="Self-service QR ordering"
            description="Customers can scan a QR code to place their own orders"
          />
          {storedProfile?.subscription_limits?.counter_enabled ? (
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
          ) : storedProfile?.subscription_limits ? (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                Counter / takeaway is not on your current plan.
              </p>
            </div>
          ) : null}
        </SectionCard>

        {/* Section 5: UPI ID */}
        <SectionCard
          title="UPI ID (VPA)"
          subtitle="Used to generate payment QR with the exact bill amount"
        >
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

        {/* Section 6: UPI QR Code */}
        <SectionCard
          title="UPI QR Code (optional)"
          subtitle="Optional static QR fallback if you prefer not to use dynamic UPI ID"
        >
          <Field label="UPI QR Code" optional>
            {form.upi_qr_code ? (
              <div className="rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-3">
                <img
                  src={form.upi_qr_code}
                  alt="UPI QR Code"
                  className="h-48 w-48 object-contain rounded-lg"
                />
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => qrInputRef.current?.click()}
                    className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white"
                  >
                    Change QR
                  </button>
                  <button
                    type="button"
                    onClick={() => set('upi_qr_code', '')}
                    className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => qrInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 py-8 text-primary"
              >
                <Camera className="h-10 w-10" />
                <span className="text-sm font-semibold">Upload QR Code</span>
              </button>
            )}
            <input
              ref={qrInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => set('upi_qr_code', reader.result as string);
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
          </Field>
        </SectionCard>
      </form>

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

      {/* Save button — form="profile-form" links it to the form above */}
      <div className="flex justify-end">
        <button
          type="submit"
          form="profile-form"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Profile
        </button>
      </div>

      {/* ── Table Modal (unified add / edit) ─────────────────────────────── */}
      <Modal
        open={tableModalMode !== null}
        onClose={closeTableModal}
        title={tableModalMode === 'add' ? 'Create New Table' : 'Edit Table'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Table Number
            </label>
            <input
              autoFocus
              type="text"
              value={tableModalName}
              maxLength={7}
              onChange={(e) => {
                setTableModalName(e.target.value);
                setTableModalError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleTableModalSave();
                }
              }}
              placeholder="Enter table name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Seating Capacity (Number of Members)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={tableModalCapacity}
              onChange={(e) => setTableModalCapacity(e.target.value)}
              placeholder="Number of seats"
              className={inputClass}
            />
          </div>

          {tableModalError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {tableModalError}
            </p>
          )}

          <div className="flex gap-3 justify-end">
            {tableModalMode === 'edit' && (
              <button
                type="button"
                onClick={() => void handleDeleteTableFromModal()}
                disabled={tableModalSaving}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Delete table
              </button>
            )}
            <button
              type="button"
              onClick={closeTableModal}
              disabled={tableModalSaving}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleTableModalSave()}
              disabled={tableModalSaving || !tableModalName.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {tableModalSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tableModalMode === 'add' ? 'Create Table' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
