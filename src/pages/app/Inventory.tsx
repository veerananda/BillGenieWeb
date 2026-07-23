import { useEffect, useState, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Check,
  RefreshCw,
  Lock,
  Search,
  ChevronDown,
  ChevronUp,
  Circle,
  Leaf,
  Beef,
  UtensilsCrossed,
  ChefHat,
  MinusCircle,
} from 'lucide-react';
import {
  apiClient,
  type Ingredient,
  type MenuItem,
  type MenuItemIngredient,
  type RecipeIngredientInput,
} from '../../services/api';
import { formatInr } from '../../data/pricing';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole, selectCanRestockInventory } from '../../store/authSlice';
import {
  selectInventoryIngredients,
  setInventoryIngredients,
  upsertInventoryIngredient,
  type InventoryIngredient,
} from '../../store/inventorySlice';
import {
  getStockWarningLevel,
  canViewIngredientManagement,
  canViewInventory,
  canRestockInventory,
} from '../../lib/inventoryAlerts';
import {
  defaultEntryUnit,
  entryUnitsFor,
  formatInventoryQty,
  shortUnitLabel,
  convertQuantity,
  unitFamily,
  canonicalUnit,
  normalizeUnit,
} from '../../lib/inventoryUnits';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { EmptyState } from '../../components/app/EmptyState';

function sameRecipeIngredient(
  existingName: string,
  existingUnit: string,
  nextName: string,
  nextUnit: string
): boolean {
  if (existingName.trim().toLowerCase() !== nextName.trim().toLowerCase()) return false;
  if (canonicalUnit(existingUnit) === canonicalUnit(nextUnit)) return true;
  const a = unitFamily(existingUnit);
  const b = unitFamily(nextUnit);
  if (a !== 'other' && a === b) return true;
  return normalizeUnit(existingUnit) === normalizeUnit(nextUnit);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

const UNIT_OPTIONS = ['pieces', 'grams', 'kg', 'ml', 'liters', 'cups', 'tablespoons', 'teaspoons'] as const;

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

function stockColor(current: number, alertQuantity: number) {
  const level = getStockWarningLevel(current, alertQuantity);
  return level === 'RED' ? '#ef4444' : level === 'YELLOW' ? '#f59e0b' : '#22c55e';
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Ingredient Mgmt
// ─────────────────────────────────────────────────────────────────────────────

interface MenuCategoryGroup {
  category: string;
  items: Array<MenuItem & { ingredients: MenuItemIngredient[] }>;
}

export function IngredientManagement() {
  const role = useAppSelector(selectAuthRole);
  const isAdmin = canViewIngredientManagement(role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<MenuCategoryGroup[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Add/Edit ingredient modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIngId, setEditingIngId] = useState<string | null>(null);
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState<string>('pieces');
  const [ingQty, setIngQty] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const [customUnitMode, setCustomUnitMode] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuItems, recipeLines] = await Promise.all([
        apiClient.listMenuItems(),
        apiClient.listMenuItemIngredients(),
      ]);

      const recipeByItem = new Map<string, MenuItemIngredient[]>();
      recipeLines.forEach((line) => {
        const prev = recipeByItem.get(line.menu_item_id) ?? [];
        prev.push(line);
        recipeByItem.set(line.menu_item_id, prev);
      });

      const catMap = new Map<string, Array<MenuItem & { ingredients: MenuItemIngredient[] }>>();
      (Array.isArray(menuItems) ? menuItems : []).forEach((item) => {
        const cat = item.category || 'Uncategorized';
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push({ ...item, ingredients: recipeByItem.get(item.id) ?? [] });
      });

      const groups = Array.from(catMap.entries()).map(([category, items]) => ({ category, items }));
      setCategoryGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load menu data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedGroup = categoryGroups.find((g) => g.category === selectedCategory);
  const selectedItem = selectedGroup?.items.find((i) => i.id === selectedItemId);

  function openAdd() {
    setEditingIngId(null);
    setIngName('');
    setIngUnit('pieces');
    setCustomUnitMode(false);
    setIngQty('');
    setUnitOpen(false);
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(ing: MenuItemIngredient) {
    setEditingIngId(ing.id);
    setIngName(ing.name);
    const known = (UNIT_OPTIONS as readonly string[]).includes(ing.unit);
    setIngUnit(ing.unit);
    setCustomUnitMode(!known);
    setIngQty(String(ing.quantity_used));
    setUnitOpen(false);
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSaveIngredient() {
    if (!ingName.trim()) { setModalError('Ingredient name is required.'); return; }
    if (!ingUnit.trim()) { setModalError('Unit is required.'); return; }
    const qty = parseFloat(ingQty);
    if (isNaN(qty) || qty <= 0) { setModalError('Enter a valid quantity.'); return; }
    if (!selectedItem) return;

    setSaving(true);
    setModalError(null);
    try {
      const unit = ingUnit.trim();
      let newList: RecipeIngredientInput[];
      if (editingIngId) {
        newList = (selectedItem.ingredients).map((ing) =>
          ing.id === editingIngId
            ? { ingredient_id: ing.ingredient_id, name: ingName.trim(), unit, quantity_used: qty }
            : { ingredient_id: ing.ingredient_id, name: ing.name, unit: ing.unit, quantity_used: ing.quantity_used }
        );
      } else {
        const name = ingName.trim();
        const existing = selectedItem.ingredients.find((ing) =>
          sameRecipeIngredient(ing.name, ing.unit, name, unit)
        );
        if (existing) {
          const addInExistingUnit = convertQuantity(qty, unit, existing.unit);
          newList = selectedItem.ingredients.map((ing) =>
            ing.id === existing.id
              ? {
                  ingredient_id: ing.ingredient_id,
                  name: ing.name,
                  unit: ing.unit,
                  quantity_used: (ing.quantity_used || 0) + addInExistingUnit,
                }
              : {
                  ingredient_id: ing.ingredient_id,
                  name: ing.name,
                  unit: ing.unit,
                  quantity_used: ing.quantity_used,
                }
          );
        } else {
          newList = [
            ...(selectedItem.ingredients).map((ing) => ({
              ingredient_id: ing.ingredient_id,
              name: ing.name,
              unit: ing.unit,
              quantity_used: ing.quantity_used,
            })),
            { name, unit, quantity_used: qty },
          ];
        }
      }
      await apiClient.setMenuItemIngredients(selectedItem.id, newList);
      await loadData();
      setModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save ingredient.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIngredient(ingId: string) {
    if (!selectedItem) return;
    if (!window.confirm('Remove this ingredient from the recipe?')) return;
    try {
      const newList = (selectedItem.ingredients)
        .filter((ing) => ing.id !== ingId)
        .map((ing) => ({
          ingredient_id: ing.ingredient_id,
          name: ing.name,
          unit: ing.unit,
          quantity_used: ing.quantity_used,
        }));
      await apiClient.setMenuItemIngredients(selectedItem.id, newList);
      await loadData();
    } catch {
      // silently handle
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Admin access only</h3>
        <p className="mt-1 text-sm text-gray-500">Ingredient management is available to admins.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error}
        <button onClick={loadData} className="ml-3 font-semibold underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredient Management"
        subtitle="Link ingredients to menu items and set recipe quantities"
      />

      {/* Category chips */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Select Menu Category</p>
        {categoryGroups.length === 0 ? (
          <p className="text-sm text-gray-400">No menu categories found.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categoryGroups.map((group) => (
              <button
                key={group.category}
                onClick={() => { setSelectedCategory(group.category); setSelectedItemId(null); }}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  selectedCategory === group.category
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {group.category}
                <span className="ml-1.5 text-xs font-normal opacity-70">({group.items.length})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item chips */}
      {selectedGroup && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Select Menu Item</p>
          <div className="flex flex-wrap gap-2">
            {selectedGroup.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  selectedItemId === item.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {item.is_veg
                  ? <Leaf className="h-4 w-4 text-green-600" />
                  : <Beef className="h-4 w-4 text-red-500" />}
                {item.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected item header */}
      {selectedItem && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
          {selectedItem.is_veg
            ? <Leaf className="h-6 w-6 shrink-0 text-green-600" />
            : <Beef className="h-6 w-6 shrink-0 text-red-500" />}
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900">{selectedItem.name}</p>
            <p className="text-sm text-gray-500">₹{Number(selectedItem.price ?? 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Ingredient recipe list */}
      {selectedItem && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-700">Ingredients</h3>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Ingredient
            </button>
          </div>

          {selectedItem.ingredients.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <ChefHat className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">No ingredients added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {selectedItem.ingredients.map((ing) => (
                <div key={ing.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{ing.name}</p>
                    <p className="text-xs text-gray-500">
                      {ing.quantity_used} {ing.unit}
                      {(ing.unit === 'kg' || ing.unit === 'liters') ? ' (inventory unit)' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(ing)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteIngredient(ing.id)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty prompt */}
      {!selectedItem && categoryGroups.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <UtensilsCrossed className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm text-gray-400">Select a menu item to manage its ingredients</p>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingIngId ? 'Edit Ingredient' : 'Add Ingredient'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ingredient Name</label>
            <input
              type="text"
              value={ingName}
              onChange={(e) => { setIngName(e.target.value); setModalError(null); }}
              placeholder="e.g. Tomatoes"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
            <p className="mb-1.5 text-xs text-gray-500">
              Weight and volume are tracked in inventory as kg and liters (e.g. 50 grams saves as 0.05 kg).
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setUnitOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 transition-colors hover:border-gray-300 focus:outline-none"
              >
                {customUnitMode ? (ingUnit.trim() || 'Custom unit') : ingUnit}
                {unitOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {unitOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        setIngUnit(u);
                        setCustomUnitMode(false);
                        setUnitOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        !customUnitMode && ingUnit === u ? 'font-semibold text-primary' : 'text-gray-700'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomUnitMode(true);
                      setIngUnit('');
                      setUnitOpen(false);
                    }}
                    className={`w-full border-t border-gray-100 px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${
                      customUnitMode ? 'text-primary' : 'text-primary'
                    }`}
                  >
                    + Add new unit
                  </button>
                </div>
              )}
            </div>
            {customUnitMode && (
              <input
                type="text"
                value={ingUnit}
                onChange={(e) => { setIngUnit(e.target.value); setModalError(null); }}
                placeholder="Enter unit (e.g. pinch, pack)"
                className={`${inputClass} mt-2`}
                autoFocus
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Quantity Used per dish</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                value={ingQty}
                onChange={(e) => { setIngQty(e.target.value); setModalError(null); }}
                placeholder="e.g. 50"
                className={inputClass}
              />
              <span className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                {ingUnit}
              </span>
            </div>
          </div>

          {modalError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{modalError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveIngredient()}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Spinner size="sm" className="text-white" />}
              {editingIngId ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock Refill
// ─────────────────────────────────────────────────────────────────────────────

export function StockRefill() {
  const dispatch = useAppDispatch();
  const role = useAppSelector(selectAuthRole);
  const canRestockPerm = useAppSelector(selectCanRestockInventory);
  const ingredients = useAppSelector(selectInventoryIngredients);
  const canRestock = role === 'admin' || role === 'manager' || canRestockPerm;
  const canManageStock = role === 'admin' || role === 'manager';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refillAmounts, setRefillAmounts] = useState<Record<string, string>>({});
  const [refillUnits, setRefillUnits] = useState<Record<string, string>>({});
  const [refillPrices, setRefillPrices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [monthSpend, setMonthSpend] = useState<number | null>(null);
  const [spendMonthLabel, setSpendMonthLabel] = useState('');

  const [deductIngredientId, setDeductIngredientId] = useState('');
  const [deductQty, setDeductQty] = useState('');
  const [deductUnit, setDeductUnit] = useState('');
  const [deducting, setDeducting] = useState(false);
  const [deductError, setDeductError] = useState<string | null>(null);
  const [deductSuccess, setDeductSuccess] = useState<string | null>(null);

  const fetchMonthlySpend = useCallback(async () => {
    if (!canManageStock) return;
    try {
      const data = await apiClient.getMonthlyStockExpenditure();
      setMonthSpend(data.total);
      const label = new Date(data.year, data.month - 1, 1).toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      setSpendMonthLabel(label);
    } catch {
      // Non-blocking — refill still works without the banner
    }
  }, [canManageStock]);

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listIngredients();
      dispatch(setInventoryIngredients(data.map(toInventoryIngredient)));
      await fetchMonthlySpend();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ingredients.');
    } finally {
      setLoading(false);
    }
  }, [dispatch, fetchMonthlySpend]);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...ingredients].sort((a, b) => {
      const aLow = a.alertQuantity > 0 && a.currentStock <= a.alertQuantity ? 0 : 1;
      const bLow = b.alertQuantity > 0 && b.currentStock <= b.alertQuantity ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, search]);

  const pendingItems = useMemo(() => {
    const items: Array<{ ingredient_id: string; quantity: number; unit: string; price?: number }> = [];
    for (const [id, raw] of Object.entries(refillAmounts)) {
      const qty = parseFloat((raw ?? '').trim());
      if (!raw?.trim() || Number.isNaN(qty) || qty <= 0) continue;
      const ingredient = ingredients.find((i) => i.id === id);
      const unit = refillUnits[id] || defaultEntryUnit(ingredient?.unit ?? '');
      const priceRaw = (refillPrices[id] ?? '').trim();
      const price = parseFloat(priceRaw);
      const item: { ingredient_id: string; quantity: number; unit: string; price?: number } = {
        ingredient_id: id,
        quantity: qty,
        unit,
      };
      if (priceRaw && !Number.isNaN(price) && price > 0) {
        item.price = price;
      }
      items.push(item);
    }
    return items;
  }, [refillAmounts, refillUnits, refillPrices, ingredients]);

  const pendingSpend = useMemo(
    () => pendingItems.reduce((sum, i) => sum + (i.price ?? 0), 0),
    [pendingItems]
  );

  const selectedDeductIngredient = useMemo(
    () => ingredients.find((i) => i.id === deductIngredientId) ?? null,
    [ingredients, deductIngredientId]
  );

  const deductUnitChoices = useMemo(
    () => (selectedDeductIngredient ? entryUnitsFor(selectedDeductIngredient.unit) : []),
    [selectedDeductIngredient]
  );

  useEffect(() => {
    if (!selectedDeductIngredient) {
      setDeductUnit('');
      return;
    }
    setDeductUnit((prev) => {
      const choices = entryUnitsFor(selectedDeductIngredient.unit);
      if (prev && choices.includes(prev)) return prev;
      return defaultEntryUnit(selectedDeductIngredient.unit);
    });
  }, [selectedDeductIngredient]);

  async function handleBulkRefill() {
    if (pendingItems.length === 0) {
      setSubmitError('Enter a quantity greater than 0 for at least one ingredient.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);
    try {
      const { ingredients: updated, expenditure_added } =
        await apiClient.restockIngredients(pendingItems);
      for (const ing of updated) {
        dispatch(upsertInventoryIngredient(toInventoryIngredient(ing)));
      }
      setRefillAmounts({});
      setRefillUnits({});
      setRefillPrices({});
      const spendNote =
        expenditure_added > 0 ? ` · ${formatInr(expenditure_added)} added to this month’s spend` : '';
      setSuccessMsg(
        `Restocked ${updated.length} ingredient${updated.length === 1 ? '' : 's'}.${spendNote}`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchMonthlySpend();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to restock.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeduct() {
    if (!canManageStock) return;
    if (!deductIngredientId) {
      setDeductError('Select an ingredient to deduct.');
      return;
    }
    const qty = parseFloat(deductQty.trim());
    if (!deductQty.trim() || Number.isNaN(qty) || qty <= 0) {
      setDeductError('Enter a quantity greater than 0.');
      return;
    }
    setDeducting(true);
    setDeductError(null);
    setDeductSuccess(null);
    try {
      const updated = await apiClient.deductIngredient({
        ingredient_id: deductIngredientId,
        quantity: qty,
        unit: deductUnit || undefined,
        reason: 'expired',
      });
      dispatch(upsertInventoryIngredient(toInventoryIngredient(updated)));
      const name = updated.name;
      setDeductQty('');
      setDeductSuccess(`Deducted expired stock from ${name}.`);
      setTimeout(() => setDeductSuccess(null), 3000);
    } catch (err) {
      setDeductError(err instanceof Error ? err.message : 'Failed to deduct stock.');
    } finally {
      setDeducting(false);
    }
  }

  if (!canRestock) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock Refill" subtitle="Add stock when ingredients run low" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Access restricted</h3>
          <p className="mt-1 text-sm text-gray-500">Ask your admin to enable stock refill permission for your account.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock Refill" subtitle="Add stock when ingredients run low" />
        <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock Refill" subtitle="Add stock when ingredients run low" />
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
          <button onClick={fetchIngredients} className="ml-3 font-semibold underline">Retry</button>
        </div>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stock Refill" subtitle="Add stock when ingredients run low" />
        <EmptyState
          icon={Package}
          title="No ingredients yet"
          description="Admin can set up inventory in Ingredient Management."
        />
      </div>
    );
  }

  const gridCols = '1fr 100px 120px 80px 110px';

  return (
    <div className="space-y-4 pb-24">
      <PageHeader title="Stock Refill" subtitle="Enter quantities and price to add, then refill all at once" />

      {canManageStock && monthSpend != null && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Stock spend · {spendMonthLabel || 'This month'}
          </p>
          <p className="mt-0.5 text-xl font-bold text-gray-900">{formatInr(monthSpend)}</p>
          <p className="text-xs text-gray-400">Total purchase cost recorded from stock refills this month.</p>
        </div>
      )}

      {canManageStock && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MinusCircle className="h-4 w-4 text-red-500" />
            <h3 className="text-sm font-bold text-gray-900">Deduct expired stock</h3>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Remove spoiled or expired quantity from inventory. Admin and managers only.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_100px_90px_auto]">
            <select
              value={deductIngredientId}
              onChange={(e) => {
                setDeductError(null);
                setDeductIngredientId(e.target.value);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">Select ingredient…</option>
              {[...ingredients]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({formatInventoryQty(ing.currentStock, ing.unit)})
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={deductQty}
              onChange={(e) => {
                setDeductError(null);
                setDeductQty(e.target.value);
              }}
              placeholder="Qty"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {deductUnitChoices.length > 1 ? (
              <select
                value={deductUnit}
                onChange={(e) => setDeductUnit(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-semibold outline-none focus:border-primary"
              >
                {deductUnitChoices.map((u) => (
                  <option key={u} value={u}>
                    {shortUnitLabel(u)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {shortUnitLabel(deductUnit || selectedDeductIngredient?.unit || '')}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleDeduct()}
              disabled={deducting || !deductIngredientId}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deducting ? 'Deducting…' : 'Deduct'}
            </button>
          </div>
          {deductError && <p className="mt-2 text-xs text-red-600">{deductError}</p>}
          {deductSuccess && <p className="mt-2 text-xs text-green-700">{deductSuccess}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredient..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      <p className="text-xs text-gray-500">
        Enter add qty, optional purchase price (₹), and choose g/kg or ml/L when available. Prices are added to this month’s stock spend.
      </p>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {submitError}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No ingredients match your search.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div
            className="grid gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span>Ingredient</span>
            <span className="text-right">Current</span>
            <span className="text-right">Add qty</span>
            <span className="text-center">Unit</span>
            <span className="text-right">Price (₹)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map((item) => {
              const color = stockColor(item.currentStock, item.alertQuantity);
              const addRaw = refillAmounts[item.id] ?? '';
              const priceRaw = refillPrices[item.id] ?? '';
              const entryChoices = entryUnitsFor(item.unit);
              const selectedUnit = refillUnits[item.id] || defaultEntryUnit(item.unit);
              return (
                <div
                  key={item.id}
                  className="grid items-center gap-3 px-4 py-3"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Circle className="h-3 w-3 shrink-0" style={{ color, fill: color }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">Tracked in {item.unit}</p>
                    </div>
                  </div>
                  <p className="text-right text-sm font-medium text-gray-700">
                    {formatInventoryQty(item.currentStock, item.unit)}
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={addRaw}
                    onChange={(e) => {
                      setSubmitError(null);
                      setRefillAmounts((prev) => ({ ...prev, [item.id]: e.target.value }));
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <select
                    value={selectedUnit}
                    onChange={(e) =>
                      setRefillUnits((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    disabled={entryChoices.length <= 1}
                    className="w-full rounded-lg border border-gray-200 bg-white px-1 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-primary disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-500"
                  >
                    {entryChoices.map((u) => (
                      <option key={u} value={u}>
                        {shortUnitLabel(u)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={priceRaw}
                    onChange={(e) => {
                      setSubmitError(null);
                      setRefillPrices((prev) => ({ ...prev, [item.id]: e.target.value }));
                    }}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-200 px-2 py-2 text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-gray-100 bg-white/95 px-1 py-3 backdrop-blur">
        {pendingSpend > 0 && (
          <p className="mb-2 text-center text-xs text-gray-500">
            This refill cost: <span className="font-semibold text-gray-800">{formatInr(pendingSpend)}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleBulkRefill()}
          disabled={submitting || pendingItems.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? (
            <Spinner size="sm" className="text-white" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {submitting
            ? 'Refilling…'
            : pendingItems.length > 0
              ? `Stock Refill (${pendingItems.length})`
              : 'Stock Refill'}
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TAB 3 — Inventory (see InventoryManagementPage.tsx)
// -----------------------------------------------------------------------------

export { InventoryManagement } from './InventoryManagementPage';

// -----------------------------------------------------------------------------
// Legacy /app/inventory → role-based default page
// -----------------------------------------------------------------------------

/** @deprecated Prefer IngredientManagement / InventoryManagement / StockRefill routes */
export function Inventory() {
  const role = useAppSelector(selectAuthRole);
  const canRestockPerm = useAppSelector(selectCanRestockInventory);

  if (canViewIngredientManagement(role)) {
    return <Navigate to="/app/ingredient-management" replace />;
  }
  if (canViewInventory(role)) {
    return <Navigate to="/app/inventory-management" replace />;
  }
  if (canRestockInventory(role, canRestockPerm)) {
    return <Navigate to="/app/stock-refill" replace />;
  }
  return <Navigate to="/app/dashboard" replace />;
}
