import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Pencil,
  Trash2,
  Copy,
  Check,
  Plus,
  Key,
} from 'lucide-react';
import { apiClient, type StaffMember } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { Badge } from '../../components/app/Badge';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffFormData {
  name: string;
  email: string;
  phone: string;
  role: 'manager' | 'staff' | 'chef';
  can_cancel_orders: boolean;
  can_restock_inventory: boolean;
}

const DEFAULT_FORM: StaffFormData = {
  name: '',
  email: '',
  phone: '',
  role: 'staff',
  can_cancel_orders: false,
  can_restock_inventory: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleBadgeVariant(
  role: string
): 'info' | 'success' | 'warning' | 'pending' {
  switch (role) {
    case 'manager':
      return 'info';
    case 'chef':
      return 'warning';
    case 'staff':
      return 'success';
    default:
      return 'pending';
  }
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Staff Form Modal ─────────────────────────────────────────────────────────

interface StaffFormModalProps {
  open: boolean;
  onClose: () => void;
  editTarget: StaffMember | null;
  onSaved: (member: StaffMember, isNew: boolean) => void;
  newlyCreatedKey: string | null;
  onDismissKey: () => void;
}

function StaffFormModal({
  open,
  onClose,
  editTarget,
  onSaved,
  newlyCreatedKey,
  onDismissKey,
}: StaffFormModalProps) {
  const [form, setForm] = useState<StaffFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          name: editTarget.name,
          email: editTarget.email ?? '',
          phone: editTarget.phone ?? '',
          role: editTarget.role,
          can_cancel_orders: editTarget.can_cancel_orders ?? false,
          can_restock_inventory: editTarget.can_restock_inventory ?? false,
        });
      } else {
        setForm(DEFAULT_FORM);
      }
      setError(null);
    }
  }, [open, editTarget]);

  function handleClose() {
    onDismissKey();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        role: form.role,
        can_cancel_orders: form.can_cancel_orders,
        can_restock_inventory: form.can_restock_inventory,
      };
      if (editTarget) {
        const updated = await apiClient.updateStaff(editTarget.id, payload);
        onSaved(updated, false);
      } else {
        const created = await apiClient.createStaff(payload);
        onSaved(created, true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editTarget ? 'Edit Staff Member' : 'Add Staff Member'}
      maxWidth="md"
    >
      {/* Success: show newly created staff key */}
      {newlyCreatedKey && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-1 text-sm font-semibold text-green-800">
            Staff member created!
          </p>
          <p className="mb-2 text-xs text-green-700">
            Share this staff key with them to log in:
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 font-mono text-sm font-medium text-gray-800 border border-green-200">
            <Key className="h-4 w-4 text-green-600 shrink-0" />
            <span className="flex-1 break-all">{newlyCreatedKey}</span>
            <CopyButton text={newlyCreatedKey} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Email <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="email@example.com"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Phone <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91 00000 00000"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Role */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as StaffFormData['role'],
              }))
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 bg-white"
          >
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="chef">Chef</option>
          </select>
        </div>

        {/* Permissions */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Permissions
          </p>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-700">Can cancel orders</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.can_cancel_orders}
              onClick={() =>
                setForm((f) => ({ ...f, can_cancel_orders: !f.can_cancel_orders }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                form.can_cancel_orders ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.can_cancel_orders ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-700">Can restock inventory</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.can_restock_inventory}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  can_restock_inventory: !f.can_restock_inventory,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                form.can_restock_inventory ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.can_restock_inventory ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
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
              {editTarget ? 'Save changes' : 'Add member'}
            </button>
          )}
        </div>
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
    <Modal
      open={!!member}
      onClose={onClose}
      title="Remove staff member"
      maxWidth="sm"
    >
      <p className="text-sm text-gray-600">
        Are you sure you want to remove{' '}
        <span className="font-semibold text-gray-900">{member?.name}</span>? This
        action cannot be undone.
      </p>
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 border border-red-200">
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
          Remove
        </button>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Staff() {
  const currentRole = useAppSelector(selectAuthRole);
  const isAdmin = currentRole === 'admin';

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setStaff((prev) => prev.map((s) => (s.id === member.id ? member : s)));
      setFormOpen(false);
    }
  }

  function handleDeleted(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        subtitle="Manage your restaurant team"
        action={
          isAdmin ? (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add staff
            </button>
          ) : undefined
        }
      />

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
                Add staff
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Name',
                    'Role',
                    'Email',
                    'Phone',
                    'Permissions',
                    'Staff Key',
                    ...(isAdmin ? ['Actions'] : []),
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="group transition-colors hover:bg-gray-50/60"
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900">
                        {member.name}
                      </p>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3">
                      <Badge variant={roleBadgeVariant(member.role)}>
                        {roleLabel(member.role)}
                      </Badge>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {member.email ?? <span className="text-gray-300">—</span>}
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {member.phone ?? <span className="text-gray-300">—</span>}
                    </td>

                    {/* Permissions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {member.can_cancel_orders ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <span className="h-3 w-3 inline-flex items-center justify-center text-red-400 font-bold">
                              ✗
                            </span>
                          )}
                          Can cancel
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {member.can_restock_inventory ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <span className="h-3 w-3 inline-flex items-center justify-center text-red-400 font-bold">
                              ✗
                            </span>
                          )}
                          Can restock
                        </span>
                      </div>
                    </td>

                    {/* Staff key */}
                    <td className="px-4 py-3">
                      {member.staff_key ? (
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                            {member.staff_key}
                          </code>
                          <CopyButton text={member.staff_key} />
                        </div>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => openEdit(member)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(member)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editTarget={editTarget}
        onSaved={handleSaved}
        newlyCreatedKey={newlyCreatedKey}
        onDismissKey={() => setNewlyCreatedKey(null)}
      />

      <DeleteModal
        member={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
