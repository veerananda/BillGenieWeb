import { useEffect, useState, useCallback } from 'react';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { apiClient, type Ingredient } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectCanRestockInventory } from '../../store/authSlice';
import {
  selectInventoryIngredients,
  setInventoryIngredients,
  upsertInventoryIngredient,
  removeInventoryIngredient,
  type InventoryIngredient,
} from '../../store/inventorySlice';
import {
  getStockWarningLevel,
  isLowStock,
  canViewIngredientManagement,
} from '../../lib/inventoryAlerts';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { EmptyState } from '../../components/app/EmptyState';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toInventoryIngredient(i: Ingredient): InventoryIngredient {
  return {
    id: i.id,
    name: i.name,
    unit: i.unit,
    currentStock: i.current_stock,
    fullStock: i.full_stock,
  };
}

const UNIT_OPTIONS = ['kg', 'g', 'L', 'ml', 'pcs', 'dozen'] as const;
type UnitOption = (typeof UNIT_OPTIONS)[number];

// ─── Stock Bar ────────────────────────────────────────────────────────────────

function StockBar({
  current,
  full,
}: {
  current: number;
  full: number;
}) {
  const level = getStockWarningLevel(current, full);
  const pct = full > 0 ? Math.min(100, (current / full) * 100) : 100;

  const barColor =
    level === 'RED'
      ? 'bg-red-500'
      : level === 'YELLOW'
      ? 'bg-amber-400'
      : 'bg-green-500';

  const trackColor =
    level === 'RED'
      ? 'bg-red-100'
      : level === 'YELLOW'
      ? 'bg-amber-100'
      : 'bg-green-100';

  return (
    <div className={`h-2 w-full rounded-full ${trackColor}`}>
      <div
        className={`h-2 rounded-full transition-all ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────

function LevelLabel({
  current,
  full,
}: {
  current: number;
  full: number;
}) {
  const level = getStockWarningLevel(current, full);
  const pct = full > 0 ? Math.round((current / full) * 100) : 100;

  const cls =
    level === 'RED'
      ? 'text-red-600 bg-red-50'
      : level === 'YELLOW'
      ? 'text-amber-600 bg-amber-50'
      : 'text-green-600 bg-green-50';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {pct}%
    </span>
  );
}

// ─── Ingredient Form Modal ────────────────────────────────────────────────────

interface IngredientFormData {
  name: string;
  unit: UnitOption | string;
  current_stock: string;
  full_stock: string;
}

const DEFAULT_INGREDIENT_FORM: IngredientFormData = {
  name: '',
  unit: 'kg',
  current_stock: '',
  full_stock: '',
};

interface IngredientModalProps {
  open: boolean;
  onClose: () => void;
  editTarget: InventoryIngredient | null;
  onSaved: (ingredient: InventoryIngredient) => void;
}

function IngredientModal({
  open,
  onClose,
  editTarget,
  onSaved,
}: IngredientModalProps) {
  const [form, setForm] = useState<IngredientFormData>(DEFAULT_INGREDIENT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          name: editTarget.name,
          unit: editTarget.unit,
          current_stock: String(editTarget.currentStock),
          full_stock: String(editTarget.fullStock),
        });
      } else {
        setForm(DEFAULT_INGREDIENT_FORM);
      }
      setError(null);
    }
  }, [open, editTarget]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const currentStock = parseFloat(form.current_stock);
    const fullStock = parseFloat(form.full_stock);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.unit.trim()) {
      setError('Unit is required.');
      return;
    }
    if (isNaN(currentStock) || currentStock < 0) {
      setError('Current stock must be a non-negative number.');
      return;
    }
    if (isNaN(fullStock) || fullStock <= 0) {
      setError('Full stock must be a positive number.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let result: Ingredient;
      if (editTarget) {
        result = await apiClient.updateIngredient(editTarget.id, {
          name: form.name.trim(),
          unit: form.unit.trim(),
          current_stock: currentStock,
          full_stock: fullStock,
        });
      } else {
        result = await apiClient.createIngredient({
          name: form.name.trim(),
          unit: form.unit.trim(),
          current_stock: currentStock,
          full_stock: fullStock,
        });
      }
      onSaved(toInventoryIngredient(result));
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save ingredient.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editTarget ? 'Edit Inventory' : 'Add Ingredient'}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Ingredient Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Tomatoes"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            className={`${inputClass} bg-white`}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Current Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.current_stock}
              onChange={(e) =>
                setForm((f) => ({ ...f, current_stock: e.target.value }))
              }
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Full Stock <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={form.full_stock}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_stock: e.target.value }))
              }
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {saving && <Spinner size="sm" className="text-white" />}
            {editTarget ? 'Save' : 'Add ingredient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteIngredientModalProps {
  ingredient: InventoryIngredient | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteIngredientModal({
  ingredient,
  onClose,
  onDeleted,
}: DeleteIngredientModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!ingredient) return;
    setDeleting(true);
    setError(null);
    try {
      await apiClient.deleteIngredient(ingredient.id);
      onDeleted(ingredient.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={!!ingredient} onClose={onClose} title="Delete Ingredient" maxWidth="sm">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete{' '}
        <span className="font-semibold text-gray-900">{ingredient?.name}</span>? This
        action cannot be undone.
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

// ─── Ingredients Tab ──────────────────────────────────────────────────────────

interface IngredientsTabProps {
  ingredients: InventoryIngredient[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (i: InventoryIngredient) => void;
  onDelete: (i: InventoryIngredient) => void;
}

function IngredientsTab({
  ingredients,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
}: IngredientsTabProps) {
  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No ingredients yet"
        description="Add ingredients to track your inventory levels."
        action={
          isAdmin ? (
            <button
              onClick={onAdd}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add ingredient
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              {[
                'Name',
                'Unit',
                'Current Stock',
                'Full Stock',
                'Level',
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
            {ingredients.map((item) => {
              const lowStock = isLowStock(item.currentStock, item.fullStock);
              return (
                <tr
                  key={item.id}
                  className={`group relative transition-colors hover:bg-gray-50/60 ${
                    lowStock ? 'border-l-2 border-l-amber-400' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {item.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {item.currentStock}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.fullStock}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[100px] flex-col gap-1">
                      <StockBar
                        current={item.currentStock}
                        full={item.fullStock}
                      />
                      <LevelLabel
                        current={item.currentStock}
                        full={item.fullStock}
                      />
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => onEdit(item)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Restock Row ──────────────────────────────────────────────────────────────

interface RestockRowProps {
  item: InventoryIngredient;
  onRestock: (id: string, qty: number) => Promise<void>;
}

function RestockRow({ item, onRestock }: RestockRowProps) {
  const [customQty, setCustomQty] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);

  async function doRestock(qty: number) {
    if (qty <= 0) return;
    setLoading(true);
    try {
      await onRestock(item.id, qty);
      setFlash(true);
      setCustomOpen(false);
      setCustomQty('');
      setTimeout(() => setFlash(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseFloat(customQty);
    if (!isNaN(qty) && qty > 0) {
      doRestock(qty);
    }
  }

  const lowStock = isLowStock(item.currentStock, item.fullStock);

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
        lowStock ? 'border-amber-200' : 'border-gray-100'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Name + bar */}
        <div className="min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{item.name}</p>
            {flash && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                <Check className="h-3 w-3" /> Restocked!
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {item.currentStock} / {item.fullStock} {item.unit}
          </p>
          <div className="mt-1.5 w-full">
            <StockBar current={item.currentStock} full={item.fullStock} />
          </div>
        </div>

        {/* Quick restock buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <Spinner size="sm" className="text-primary" />
          ) : (
            <>
              {[1, 2, 5, 10].map((qty) => (
                <button
                  key={qty}
                  onClick={() => doRestock(qty)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                  +{qty}
                </button>
              ))}
              <button
                onClick={() => setCustomOpen((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  customOpen
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-primary hover:bg-primary/10 hover:text-primary'
                }`}
              >
                Custom
              </button>
            </>
          )}
        </div>
      </div>

      {/* Custom qty inline form */}
      {customOpen && !loading && (
        <form
          onSubmit={handleCustomSubmit}
          className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3"
        >
          <input
            type="number"
            min="0.01"
            step="any"
            value={customQty}
            onChange={(e) => setCustomQty(e.target.value)}
            placeholder={`Quantity (${item.unit})`}
            className="w-40 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            autoFocus
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Add to stock
          </button>
          <button
            type="button"
            onClick={() => { setCustomOpen(false); setCustomQty(''); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Restock Tab ──────────────────────────────────────────────────────────────

interface RestockTabProps {
  ingredients: InventoryIngredient[];
  canRestock: boolean;
  onRestock: (id: string, qty: number) => Promise<void>;
}

function RestockTab({ ingredients, canRestock, onRestock }: RestockTabProps) {
  if (!canRestock) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Access restricted
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Ask your admin to enable stock refill permission for your account.
        </p>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No ingredients yet."
        description="Admin can set up inventory in Ingredient Management."
      />
    );
  }

  // Sort by stock ratio ascending (lowest first)
  const sorted = [...ingredients].sort((a, b) => {
    const ratioA = a.fullStock > 0 ? a.currentStock / a.fullStock : 1;
    const ratioB = b.fullStock > 0 ? b.currentStock / b.fullStock : 1;
    return ratioA - ratioB;
  });

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <RestockRow key={item.id} item={item} onRestock={onRestock} />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'ingredients' | 'restock';

export function Inventory() {
  const dispatch = useAppDispatch();
  const role = useAppSelector(selectAuthRole);
  const canRestockPerm = useAppSelector(selectCanRestockInventory);
  const ingredients = useAppSelector(selectInventoryIngredients);

  const isAdmin = canViewIngredientManagement(role);
  // Admins and managers can always restock; staff/chef need flag
  const canRestock =
    role === 'admin' || role === 'manager' || canRestockPerm;

  const [activeTab, setActiveTab] = useState<Tab>('ingredients');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryIngredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryIngredient | null>(null);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listIngredients();
      dispatch(setInventoryIngredients(data.map(toInventoryIngredient)));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load ingredients.'
      );
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  function openAdd() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(item: InventoryIngredient) {
    setEditTarget(item);
    setFormOpen(true);
  }

  function handleSaved(ingredient: InventoryIngredient) {
    dispatch(upsertInventoryIngredient(ingredient));
  }

  function handleDeleted(id: string) {
    dispatch(removeInventoryIngredient(id));
  }

  async function handleRestock(id: string, quantity: number) {
    const result = await apiClient.restockIngredient(id, quantity);
    dispatch(upsertInventoryIngredient(toInventoryIngredient(result)));
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ingredients', label: 'Ingredients' },
    { id: 'restock', label: 'Restock' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Track and manage ingredient stock levels"
        action={
          isAdmin && activeTab === 'ingredients' ? (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add ingredient
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
          <button
            onClick={fetchIngredients}
            className="ml-3 font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : activeTab === 'ingredients' ? (
        <IngredientsTab
          ingredients={ingredients}
          isAdmin={isAdmin}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      ) : (
        <RestockTab
          ingredients={ingredients}
          canRestock={canRestock}
          onRestock={handleRestock}
        />
      )}

      {/* Modals */}
      <IngredientModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editTarget={editTarget}
        onSaved={handleSaved}
      />

      <DeleteIngredientModal
        ingredient={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
