import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Pencil,
  Trash2,
  Copy,
  Check,
  Plus,
  Key,
  RefreshCw,
  User,
  Briefcase,
  ChefHat,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiClient, type StaffMember } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits, canAssignChefRole } from '../../lib/subscriptionLimits';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { Badge } from '../../components/app/Badge';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Utils ────────────────────────────────────────────────────────────────────

function generateStaffKey(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffFormData {
  name: string;
  role: 'manager' | 'staff' | 'chef';
  staff_key: string;
  password: string;
  can_cancel_orders: boolean;
  can_restock_inventory: boolean;
  menu_management_access: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadgeVariant(role: string): 'info' | 'success' | 'warning' | 'pending' {
  switch (role) {
    case 'admin':   return 'pending';
    case 'manager': return 'info';
    case 'chef':    return 'warning';
    case 'staff':   return 'success';
    default:        return 'pending';
  }
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-1 rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── RoleTile ─────────────────────────────────────────────────────────────────

function RoleTile({
  icon: Icon,
  label,
  desc,
  selected,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all disabled:opacity-45 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <Icon className={`h-5 w-5 ${selected ? 'text-primary' : 'text-gray-400'}`} />
      <span className={`text-sm font-bold ${selected ? 'text-primary' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-[11px] leading-tight ${selected ? 'text-primary/70' : 'text-gray-400'}`}>
        {desc}
      </span>
    </button>
  );
}

// ─── PermissionRow ────────────────────────────────────────────────────────────

function PermissionRow({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-400">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
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

// ─── Staff Form Modal ─────────────────────────────────────────────────────────

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  editTarget: StaffMember | null;
  onSaved: (member: StaffMember, isNew: boolean) => void;
  newlyCreatedKey: string | null;
  onDismissKey: () => void;
  kitchenEnabled: boolean;
}

function StaffFormModal({
  open,
  onClose,
  editTarget,
  onSaved,
  newlyCreatedKey,
  onDismissKey,
  kitchenEnabled,
}: StaffFormModalProps) {
  const isEdit = !!editTarget;
  const isAdmin = editTarget?.role === 'admin';

  const [form, setForm] = useState<StaffFormData>({
    name: '',
    role: 'staff',
    staff_key: generateStaffKey(),
    password: '',
    can_cancel_orders: false,
    can_restock_inventory: false,
    menu_management_access: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedKey, setRegeneratedKey] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          name: editTarget.name,
          role: (editTarget.role === 'admin' ? 'staff' : editTarget.role) as 'manager' | 'staff' | 'chef',
          staff_key: editTarget.staff_key ?? '',
          password: '',
          can_cancel_orders: editTarget.can_cancel_orders ?? false,
          can_restock_inventory: editTarget.can_restock_inventory ?? false,
          menu_management_access: editTarget.menu_management_access ?? false,
        });
      } else {
        setForm({
          name: '',
          role: 'staff',
          staff_key: generateStaffKey(),
          password: '',
          can_cancel_orders: false,
          can_restock_inventory: false,
          menu_management_access: false,
        });
      }
      setError(null);
      setErrors({});
      setRegeneratedKey(null);
      setShowPassword(false);
    }
  }, [open, editTarget]);

  useEffect(() => {
    if (!open || isEdit || kitchenEnabled || form.role !== 'chef') return;
    setForm((f) => ({ ...f, role: 'staff', can_cancel_orders: false }));
  }, [open, isEdit, kitchenEnabled, form.role]);

  function handleClose() {
    onDismissKey();
    onClose();
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';

    if (!isEdit) {
      if (!form.password.trim()) errs.password = 'Password is required';
      else if (form.password.trim().length < 6) errs.password = 'Password must be at least 6 characters';
    } else {
      if (form.password && form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const wasChef = editTarget?.role === 'chef';
    const assigningChef = form.role === 'chef';
    if (!isAdmin && assigningChef && !kitchenEnabled && !wasChef) {
      setError('Chef accounts require a kitchen add-on on your plan.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isEdit && editTarget) {
        const payload: Parameters<typeof apiClient.updateStaff>[1] = {
          name: form.name.trim(),
        };
        if (!isAdmin) {
          payload.role = form.role;
          if (form.role === 'staff') payload.can_cancel_orders = form.can_cancel_orders;
          if (form.role === 'staff' || form.role === 'chef') payload.can_restock_inventory = form.can_restock_inventory;
          if (form.role === 'manager') payload.menu_management_access = form.menu_management_access;
        }
        if (form.password.trim()) payload.password = form.password.trim();
        const updated = await apiClient.updateStaff(editTarget.id, payload);
        onSaved(updated, false);
      } else {
        const payload: Parameters<typeof apiClient.createStaff>[0] = {
          name: form.name.trim(),
          role: form.role,
          staff_key: form.staff_key,
          password: form.password.trim(),
        };
        if (form.role === 'staff') payload.can_cancel_orders = form.can_cancel_orders;
        if (form.role === 'staff' || form.role === 'chef') payload.can_restock_inventory = form.can_restock_inventory;
        if (form.role === 'manager') payload.menu_management_access = form.menu_management_access;
        const created = await apiClient.createStaff(payload);
        onSaved(created, true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateKey() {
    if (!editTarget) return;
    if (!window.confirm(`Generate a new 6-digit login key for ${editTarget.name}? The old key will stop working immediately.`)) return;
    setRegenerating(true);
    setError(null);
    try {
      const updated = await apiClient.regenerateStaffKey(editTarget.id);
      setRegeneratedKey(updated.staff_key ?? null);
      onSaved(updated, false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate key.');
    } finally {
      setRegenerating(false);
    }
  }

  const modalTitle = isEdit
    ? isAdmin
      ? 'Edit Admin'
      : `Edit ${form.role.charAt(0).toUpperCase() + form.role.slice(1)}`
    : 'Add Staff Member';

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} maxWidth="md">
      {/* Newly created key banner */}
      {newlyCreatedKey && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-1 text-sm font-semibold text-green-800">Staff member created!</p>
          <p className="mb-2 text-xs text-green-700">
            Share this login key and password with them:
          </p>
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-white px-4 py-3">
            <Key className="h-4 w-4 shrink-0 text-green-600" />
            <span className="flex-1 text-center font-mono text-2xl font-extrabold tracking-[0.3em] text-primary">
              {newlyCreatedKey}
            </span>
            <CopyButton text={newlyCreatedKey} />
          </div>
        </div>
      )}

      {/* Regenerated key banner */}
      {regeneratedKey && !newlyCreatedKey && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-1 text-sm font-semibold text-amber-800">New key generated!</p>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
            <code className="flex-1 text-center font-mono text-xl font-bold tracking-[0.3em] text-amber-700">
              {regeneratedKey}
            </code>
            <CopyButton text={regeneratedKey} />
          </div>
          <p className="mt-1 text-xs text-amber-600">
            Share the new key. Password is unchanged.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }));
              setErrors((er) => ({ ...er, name: '' }));
            }}
            placeholder="Enter staff member's name"
            autoFocus
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/20 ${
              errors.name ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-primary'
            }`}
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>


        {/* Login Key — add mode only */}
        {!isEdit && !newlyCreatedKey && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Login Key</label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="flex-1 text-center font-mono text-3xl font-extrabold tracking-[0.3em] text-primary">
                {form.staff_key}
              </span>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, staff_key: generateStaffKey() }))}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-primary"
                title="Regenerate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Unique 6-digit login key for this staff member. They enter this on the login screen.
            </p>
          </div>
        )}

        {/* Password */}
        {!newlyCreatedKey && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {isEdit ? 'New Password (Optional)' : <>Password <span className="text-red-500">*</span></>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }));
                  setErrors((er) => ({ ...er, password: '' }));
                }}
                placeholder={isEdit ? 'Leave blank to keep current password' : 'Min 6 characters'}
                className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary/20 ${
                  errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-primary'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 transition hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            {isEdit && !errors.password && (
              <p className="mt-1 text-xs text-gray-400">Leave blank to keep current password.</p>
            )}
            {!isEdit && (
              <p className="mt-1 text-xs text-gray-400">
                Staff use this password with their login key to sign in.
              </p>
            )}
          </div>
        )}

        {/* Divider before role/permissions */}
        {!isAdmin && !newlyCreatedKey && <hr className="border-gray-100" />}

        {/* Role tiles — not for admin */}
        {!isAdmin && !newlyCreatedKey && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
            {!kitchenEnabled && isEdit && editTarget?.role === 'chef' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <span className="font-semibold">Chef</span> — role kept; kitchen screen is locked until a kitchen
                add-on is enabled. You can change role to Staff or Manager below.
              </div>
            ) : null}
            <div className="mt-2 flex gap-3">
              <RoleTile
                icon={User}
                label="Staff"
                desc="Orders & billing"
                selected={form.role === 'staff'}
                onClick={() => setForm((f) => ({ ...f, role: 'staff' }))}
              />
              <RoleTile
                icon={Briefcase}
                label="Manager"
                desc="Menu & settings"
                selected={form.role === 'manager'}
                onClick={() =>
                  setForm((f) => ({ ...f, role: 'manager', can_cancel_orders: false, menu_management_access: false }))
                }
              />
              {kitchenEnabled && (
                <RoleTile
                  icon={ChefHat}
                  label="Chef"
                  desc="Kitchen only"
                  selected={form.role === 'chef'}
                  onClick={() =>
                    setForm((f) => ({ ...f, role: 'chef', can_cancel_orders: false }))
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Permissions — conditional on role */}
        {!isAdmin && !newlyCreatedKey && form.role === 'staff' && (
          <PermissionRow
            title="Allow cancel order"
            hint="When enabled, this staff member can cancel the full dine-in table order from table info."
            checked={form.can_cancel_orders}
            onChange={(v) => setForm((f) => ({ ...f, can_cancel_orders: v }))}
          />
        )}
        {!isAdmin && !newlyCreatedKey && (form.role === 'staff' || form.role === 'chef') && (
          <PermissionRow
            title="Allow stock refill"
            hint="When enabled, this user can add received stock on the Stock Management page."
            checked={form.can_restock_inventory}
            onChange={(v) => setForm((f) => ({ ...f, can_restock_inventory: v }))}
          />
        )}
        {!isAdmin && !newlyCreatedKey && form.role === 'manager' && (
          <PermissionRow
            title="Full menu management"
            hint="When enabled, this manager can add, edit, and delete menu categories and items. When off, they can only turn item availability on or off."
            checked={form.menu_management_access}
            onChange={(v) => setForm((f) => ({ ...f, menu_management_access: v }))}
          />
        )}

        {/* Tips / info box */}
        {!newlyCreatedKey && (
          <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">
                {isEdit ? 'Information' : 'Tips'}
              </span>
            </div>
            <p className="whitespace-pre-line text-xs leading-relaxed text-primary/80">
              {isEdit
                ? isAdmin
                  ? '• Admin account cannot be deleted\n• Use email + password to log in as admin'
                  : '• Share the 6-digit login key with staff\n• Chef role requires a kitchen add-on\n• Regenerating a key resets login to the new key'
                : '• Chef is available only with a kitchen add-on\n• Share the 6-digit login key and password with the staff member\n• Login: Staff Key + Password'}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Primary actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {newlyCreatedKey ? 'Done' : 'Cancel'}
          </button>
          {!newlyCreatedKey && (
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Spinner size="sm" className="text-white" />}
              {isEdit ? 'Save Changes' : 'Create Staff Member'}
            </button>
          )}
        </div>

        {/* Regenerate Staff Key — edit mode, non-admin */}
        {isEdit && !isAdmin && !newlyCreatedKey && (
          <button
            type="button"
            onClick={handleRegenerateKey}
            disabled={regenerating}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            {regenerating ? <Spinner size="sm" className="text-amber-600" /> : <Key className="h-4 w-4" />}
            Regenerate Staff Key
          </button>
        )}
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  member: StaffMember | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteModal({ member, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!member) return;
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deleteStaff(member.id);
      onDeleted(member.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={!!member} onClose={onClose} title="Delete Staff Member" maxWidth="sm">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete{' '}
        <span className="font-semibold text-gray-900">{member?.name}</span>? This action cannot be
        undone.
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
        >
          {deleting && <Spinner size="sm" className="text-white" />}
          Delete
        </button>
      </div>
    </Modal>
  );
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

function StaffCard({
  member,
  isAdmin,
  onEdit,
  onDelete,
}: {
  member: StaffMember;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-gray-900">{member.name}</p>

        {/* Login key */}
        {member.role !== 'admin' && member.staff_key && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Login key
            </p>
            <div className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1.5">
              <code className="flex-1 font-mono text-sm font-semibold text-gray-800">
                {member.staff_key}
              </code>
              <CopyButton text={member.staff_key} />
            </div>
          </div>
        )}

        {/* Tags row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={roleBadgeVariant(member.role)}>
            {member.role.toUpperCase()}
          </Badge>
        </div>

        {/* Permission chips */}
        {(member.can_cancel_orders || member.can_restock_inventory || member.menu_management_access) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.can_cancel_orders && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                <Check className="h-3 w-3" /> Cancel orders
              </span>
            )}
            {member.can_restock_inventory && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                <Check className="h-3 w-3" /> Stock refill
              </span>
            )}
            {member.menu_management_access && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
                <Check className="h-3 w-3" /> Menu management
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {member.role !== 'admin' && (
            <button
              onClick={onDelete}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-colors hover:bg-red-100"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Staff() {
  const currentRole = useAppSelector(selectAuthRole);
  const isAdmin = currentRole === 'admin';
  const profile = useAppSelector(selectProfile);

  // Always parse so defaults kick in even when raw API omits a field
  const limits = profile
    ? parseSubscriptionLimits(profile.subscription_limits as Record<string, unknown> | undefined)
    : null;
  const kitchenEnabled = limits ? canAssignChefRole(limits) : false;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Always count from the live local list so add/delete immediately reflects in the gate.
  // The profile usage snapshot is stale and doesn't update on mutation.
  const staffCount = staff.filter((s) => s.role === 'staff' || s.role === 'chef').length;
  const managerCount = staff.filter((s) => s.role === 'manager').length;

  const staffSeatAvailable = limits
    ? staffCount < limits.max_staff_and_chefs || managerCount < limits.max_managers
    : true;

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listStaff();
      setStaff(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load staff.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  function openAdd() {
    setEditTarget(null);
    setNewlyCreatedKey(null);
    setFormOpen(true);
  }

  function openEdit(member: StaffMember) {
    setEditTarget(member);
    setNewlyCreatedKey(null);
    setFormOpen(true);
  }

  function handleSaved(member: StaffMember, isNew: boolean) {
    if (isNew) {
      setStaff((prev) => [...prev, member]);
      if (member.staff_key) {
        setNewlyCreatedKey(member.staff_key);
      } else {
        setFormOpen(false);
      }
    } else {
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, ...member } : s)));
      setFormOpen(false);
    }
  }

  function handleDeleted(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team Management"
        subtitle={
          loading
            ? 'Loading…'
            : `${staff.length} team member${staff.length !== 1 ? 's' : ''}`
        }
        action={
          isAdmin ? (
            <button
              onClick={openAdd}
              disabled={!staffSeatAvailable}
              title={!staffSeatAvailable ? 'Plan limit reached — upgrade to add more staff' : undefined}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Staff
            </button>
          ) : undefined
        }
      />

      {/* Plan seat tracker */}
      {limits && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Plan</span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              staffCount >= limits.max_staff_and_chefs
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            Staff &amp; Chefs: {staffCount} / {limits.max_staff_and_chefs}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              managerCount >= limits.max_managers
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            Managers: {managerCount} / {limits.max_managers}
          </span>
          {!staffSeatAvailable && (
            <span className="ml-auto text-xs text-red-600 font-medium">
              Plan limit reached — upgrade to add more
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
          <button
            onClick={fetchStaff}
            className="ml-3 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff members yet"
          description="Add your first staff member to get started."
          action={
            isAdmin ? (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Add Staff
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <StaffCard
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              onEdit={() => openEdit(member)}
              onDelete={() => setDeleteTarget(member)}
            />
          ))}
        </div>
      )}

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editTarget={editTarget}
        onSaved={handleSaved}
        newlyCreatedKey={newlyCreatedKey}
        onDismissKey={() => setNewlyCreatedKey(null)}
        kitchenEnabled={kitchenEnabled}
      />

      <DeleteModal
        member={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
