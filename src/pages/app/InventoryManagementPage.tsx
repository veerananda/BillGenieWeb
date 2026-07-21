import { useEffect, useState, useCallback, useMemo } from 'react';
import { Package, Pencil, Trash2, Check, AlertTriangle, Circle } from 'lucide-react';
import { apiClient, type Ingredient } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
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

function toInventoryIngredient(i: Ingredient): InventoryIngredient {
  return {
    id: i.id,
    name: i.name,
    unit: i.unit,
    currentStock: i.current_stock,
    fullStock: i.full_stock,
    alertQuantity: i.alert_quantity ?? 0,
  };
}

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

function stockColor(current: number, alertQuantity: number) {
  const level = getStockWarningLevel(current, alertQuantity);
  return level === 'RED' ? '#ef4444' : level === 'YELLOW' ? '#f59e0b' : '#22c55e';
}

function StockBar({ current, alertQuantity }: { current: number; alertQuantity: number }) {
  if (alertQuantity <= 0) {
    return <div className="h-1.5 w-full rounded-full bg-gray-100" />;
  }
  const level = getStockWarningLevel(current, alertQuantity);
  const pct = Math.min(100, Math.max(0, (current / Math.max(alertQuantity, current, 1)) * 100));
  const barColor = level === 'RED' ? 'bg-red-500' : level === 'YELLOW' ? 'bg-amber-400' : 'bg-green-500';
  const trackColor = level === 'RED' ? 'bg-red-100' : level === 'YELLOW' ? 'bg-amber-100' : 'bg-green-100';
  return (
    <div className={`h-1.5 w-full rounded-full ${trackColor}`}>
      <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function InventoryManagement() {
  const dispatch = useAppDispatch();
  const role = useAppSelector(selectAuthRole);
  const ingredients = useAppSelector(selectInventoryIngredients);
  const isAdmin = canViewIngredientManagement(role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryIngredient | null>(null);
  const [draftAlerts, setDraftAlerts] = useState<Record<string, string>>({});
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listIngredients();
      dispatch(setInventoryIngredients(data.map(toInventoryIngredient)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients.');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void fetchIngredients();
  }, [fetchIngredients]);

  const lowStockItems = ingredients.filter((i) => isLowStock(i.currentStock, i.alertQuantity));

  const pendingEdits = useMemo(() => {
    const items: Array<{ ingredient_id: string; alert_quantity: number }> = [];
    for (const id of editingIds) {
      const raw = draftAlerts[id];
      if (raw === undefined) continue;
      const qty = parseFloat(raw);
      if (Number.isNaN(qty) || qty < 0) continue;
      const original = ingredients.find((i) => i.id === id);
      if (!original || qty === original.alertQuantity) continue;
      items.push({ ingredient_id: id, alert_quantity: qty });
    }
    return items;
  }, [editingIds, draftAlerts, ingredients]);

  function startEdit(item: InventoryIngredient) {
    setEditingIds((prev) => new Set(prev).add(item.id));
    setDraftAlerts((prev) => ({
      ...prev,
      [item.id]: prev[item.id] ?? String(item.alertQuantity),
    }));
    setSaveError(null);
    setSaveSuccess(null);
  }

  function cancelEdit(id: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDraftAlerts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleUpdateInventory() {
    if (editingIds.size === 0) {
      setSaveError('Tap Edit beside Alert qty on one or more rows first.');
      return;
    }
    for (const id of editingIds) {
      const raw = draftAlerts[id];
      const qty = parseFloat(raw ?? '');
      if (raw === undefined || Number.isNaN(qty) || qty < 0) {
        setSaveError('Alert quantity must be a number ≥ 0 for every row you are editing.');
        return;
      }
    }
    if (pendingEdits.length === 0) {
      setEditingIds(new Set());
      setDraftAlerts({});
      setSaveSuccess('No alert quantity changes to save.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const updated = await apiClient.bulkUpdateIngredients(pendingEdits);
      for (const row of updated) {
        dispatch(upsertInventoryIngredient(toInventoryIngredient(row)));
      }
      setEditingIds(new Set());
      setDraftAlerts({});
      setSaveSuccess(
        `Updated alert quantity for ${pendingEdits.length} item${pendingEdits.length === 1 ? '' : 's'}.`
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update inventory.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory" subtitle="Track stock levels across ingredients" />
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory" subtitle="Track stock levels across ingredients" />
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
          <button onClick={() => void fetchIngredients()} className="ml-3 font-semibold underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory" subtitle="Track stock levels across ingredients" />
        <EmptyState
          icon={Package}
          title="No ingredients yet"
          description="Add ingredients from Ingredient Management."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        subtitle="Current stock is updated from Stock Refill. Set alert quantity to get low-stock notices."
        action={
          isAdmin ? (
            <button
              onClick={() => void handleUpdateInventory()}
              disabled={saving || editingIds.size === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Spinner size="sm" className="text-white" /> : <Check className="h-4 w-4" />}
              Update inventory
            </button>
          ) : undefined
        }
      />

      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-700">Low Stock Alert</p>
            <p className="text-sm text-amber-600">
              {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} at or below alert quantity —
              check Stock Refill.
            </p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}
      {saveSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {saveSuccess}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div
          className="grid gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white"
          style={{
            backgroundColor: 'var(--color-primary)',
            gridTemplateColumns: isAdmin ? '1.4fr 1fr 1.2fr 80px 56px' : '1.4fr 1fr 1fr 80px',
          }}
        >
          <span>Ingredient</span>
          <span>Current qty</span>
          <span>Alert qty</span>
          <span className="text-center">Unit</span>
          {isAdmin && <span className="text-center">Delete</span>}
        </div>

        <div className="divide-y divide-gray-50">
          {ingredients.map((item) => {
            const color = stockColor(item.currentStock, item.alertQuantity);
            const isEditing = editingIds.has(item.id);
            return (
              <div
                key={item.id}
                className="grid items-center gap-3 px-4 py-3"
                style={{
                  gridTemplateColumns: isAdmin ? '1.4fr 1fr 1.2fr 80px 56px' : '1.4fr 1fr 1fr 80px',
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Circle className="h-3 w-3 shrink-0" style={{ color, fill: color }} />
                  <span className="truncate text-sm font-semibold text-gray-900">{item.name}</span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.currentStock.toFixed(2)}</p>
                  <div className="mt-1">
                    <StockBar current={item.currentStock} alertQuantity={item.alertQuantity} />
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={draftAlerts[item.id] ?? ''}
                        onChange={(e) =>
                          setDraftAlerts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className={`${inputClass} py-1.5`}
                      />
                      <button
                        type="button"
                        onClick={() => cancelEdit(item.id)}
                        className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100"
                        title="Cancel edit"
                      >
                        Undo
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-800">
                        {item.alertQuantity > 0 ? item.alertQuantity.toFixed(2) : '—'}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Edit alert qty"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="text-center text-sm text-gray-500">{item.unit}</div>

                {isAdmin && (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <DeleteModal
        ingredient={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => {
          dispatch(removeInventoryIngredient(id));
          cancelEdit(id);
        }}
      />
    </div>
  );
}

function DeleteModal({
  ingredient,
  onClose,
  onDeleted,
}: {
  ingredient: InventoryIngredient | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
      setDeleting(false);
    }
  }

  return (
    <Modal open={!!ingredient} onClose={onClose} title="Delete Ingredient" maxWidth="sm">
      <p className="text-sm text-gray-600">
        Are you sure you want to delete{' '}
        <span className="font-semibold text-gray-900">{ingredient?.name}</span>? This cannot be undone.
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {deleting && <Spinner size="sm" className="text-white" />}
          Delete
        </button>
      </div>
    </Modal>
  );
}
