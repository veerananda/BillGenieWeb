import { useEffect, useState, useCallback, useMemo } from 'react';
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
  AlertTriangle,
  Circle,
  Leaf,
  Beef,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import {
  apiClient,
  type Ingredient,
  type MenuItem,
  type MenuItemIngredient,
  type RecipeIngredientInput,
} from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole, selectCanRestockInventory } from '../../store/authSlice';
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

// ─── Shared helpers ───────────────────────────────────────────────────────────

function toInventoryIngredient(i: Ingredient): InventoryIngredient {
  return { id: i.id, name: i.name, unit: i.unit, currentStock: i.current_stock, fullStock: i.full_stock };
}

const UNIT_OPTIONS = ['pieces', 'grams', 'kg', 'ml', 'liters', 'cups', 'tablespoons', 'teaspoons'] as const;

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

function stockColor(current: number, full: number) {
  const level = getStockWarningLevel(current, full);
  return level === 'RED' ? '#ef4444' : level === 'YELLOW' ? '#f59e0b' : '#22c55e';
}

// ─── Stock bar ────────────────────────────────────────────────────────────────

function StockBar({ current, full }: { current: number; full: number }) {
  const level = getStockWarningLevel(current, full);
  const pct = full > 0 ? Math.min(100, (current / full) * 100) : 100;
  const barColor = level === 'RED' ? 'bg-red-500' : level === 'YELLOW' ? 'bg-amber-400' : 'bg-green-500';
  const trackColor = level === 'RED' ? 'bg-red-100' : level === 'YELLOW' ? 'bg-amber-100' : 'bg-green-100';
  return (
    <div className={`h-1.5 w-full rounded-full ${trackColor}`}>
      <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Ingredient Mgmt
// ─────────────────────────────────────────────────────────────────────────────

interface MenuCategoryGroup {
  category: string;
  items: Array<MenuItem & { ingredients: MenuItemIngredient[] }>;
}

interface IngredientMgmtTabProps {
  isAdmin: boolean;
}

function IngredientMgmtTab({ isAdmin }: IngredientMgmtTabProps) {
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
    setIngQty('');
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(ing: MenuItemIngredient) {
    setEditingIngId(ing.id);
    setIngName(ing.name);
    setIngUnit(ing.unit);
    setIngQty(String(ing.quantity_used));
    setModalError(null);
    setModalOpen(true);
  }

  async function handleSaveIngredient() {
    if (!ingName.trim()) { setModalError('Ingredient name is required.'); return; }
    const qty = parseFloat(ingQty);
    if (isNaN(qty) || qty <= 0) { setModalError('Enter a valid quantity.'); return; }
    if (!selectedItem) return;

    setSaving(true);
    setModalError(null);
    try {
      let newList: RecipeIngredientInput[];
      if (editingIngId) {
        newList = (selectedItem.ingredients).map((ing) =>
          ing.id === editingIngId
            ? { ingredient_id: ing.ingredient_id, name: ingName.trim(), unit: ingUnit, quantity_used: qty }
            : { ingredient_id: ing.ingredient_id, name: ing.name, unit: ing.unit, quantity_used: ing.quantity_used }
        );
      } else {
        newList = [
          ...(selectedItem.ingredients).map((ing) => ({
            ingredient_id: ing.ingredient_id,
            name: ing.name,
            unit: ing.unit,
            quantity_used: ing.quantity_used,
          })),
          { name: ingName.trim(), unit: ingUnit, quantity_used: qty },
        ];
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setUnitOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 transition-colors hover:border-gray-300 focus:outline-none"
              >
                {ingUnit}
                {unitOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {unitOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => { setIngUnit(u); setUnitOpen(false); }}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                        ingUnit === u ? 'font-semibold text-primary' : 'text-gray-700'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
// TAB 2 — Stock Refill
// ─────────────────────────────────────────────────────────────────────────────

function quickAddOptions(unit: string): number[] {
  if (unit === 'kg' || unit === 'liters') return [1, 2, 5, 10];
  return [1, 5, 10, 25];
}

interface StockRefillTabProps {
  ingredients: InventoryIngredient[];
  canRestock: boolean;
  onRestock: (id: string, qty: number) => Promise<void>;
}

function StockRefillTab({ ingredients, canRestock, onRestock }: StockRefillTabProps) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refillAmounts, setRefillAmounts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...ingredients].sort((a, b) => {
      const ra = a.fullStock > 0 ? a.currentStock / a.fullStock : 1;
      const rb = b.fullStock > 0 ? b.currentStock / b.fullStock : 1;
      return ra - rb;
    });
    if (!q) return sorted;
    return sorted.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, search]);

  async function handleRefill(item: InventoryIngredient) {
    const raw = (refillAmounts[item.id] ?? '').trim();
    const qty = parseFloat(raw);
    if (!raw || isNaN(qty) || qty <= 0) return;
    setSubmittingId(item.id);
    try {
      await onRestock(item.id, qty);
      setFlashId(item.id);
      setRefillAmounts((prev) => ({ ...prev, [item.id]: '' }));
      setExpandedId(null);
      setTimeout(() => setFlashId(null), 2000);
    } finally {
      setSubmittingId(null);
    }
  }

  if (!canRestock) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Access restricted</h3>
        <p className="mt-1 text-sm text-gray-500">Ask your admin to enable stock refill permission for your account.</p>
      </div>
    );
  }

  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No ingredients yet"
        description="Admin can set up inventory in Ingredient Management."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
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
        Tap an ingredient, enter refill quantity, and add to stock.
      </p>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">No ingredients match your search.</p>
      )}

      {filtered.map((item) => {
        const isExpanded = expandedId === item.id;
        const isSubmitting = submittingId === item.id;
        const flash = flashId === item.id;
        const color = stockColor(item.currentStock, item.fullStock);

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
          >
            {/* Card header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : item.id)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-50/60"
            >
              <Circle className="h-3.5 w-3.5 shrink-0" style={{ color, fill: color }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Current: {item.currentStock} {item.unit}
                  {flash && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                      <Check className="h-3 w-3" /> Restocked!
                    </span>
                  )}
                </p>
              </div>
              {isExpanded
                ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
            </button>

            {/* Expanded panel */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50/40 px-4 pb-4 pt-3">
                <p className="mb-2.5 text-xs font-medium text-gray-500">
                  Quick add ({item.unit})
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {quickAddOptions(item.unit).map((qty) => (
                    <button
                      key={qty}
                      onClick={() => setRefillAmounts((prev) => ({ ...prev, [item.id]: String(qty) }))}
                      className="rounded-full border border-primary bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={refillAmounts[item.id] ?? ''}
                  onChange={(e) => setRefillAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder={`Quantity to add (${item.unit})`}
                  className="mb-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => void handleRefill(item)}
                  disabled={isSubmitting || !refillAmounts[item.id]}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting
                    ? <Spinner size="sm" className="text-white" />
                    : <RefreshCw className="h-4 w-4" />}
                  Add to stock
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Inventory
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryTabProps {
  ingredients: InventoryIngredient[];
  isAdmin: boolean;
  onEdit: (i: InventoryIngredient) => void;
  onDelete: (i: InventoryIngredient) => void;
}

function InventoryTab({ ingredients, isAdmin, onEdit, onDelete }: InventoryTabProps) {
  const lowStockItems = ingredients.filter((i) => isLowStock(i.currentStock, i.fullStock));

  if (ingredients.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No ingredients yet"
        description="Add ingredients from the Ingredient Mgmt tab."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-700">Low Stock Alert</p>
            <p className="text-sm text-amber-600">
              {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} below 25% — check Stock Refill tab.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Header */}
        <div
          className="grid gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white"
          style={{
            backgroundColor: 'var(--color-primary)',
            gridTemplateColumns: isAdmin ? '1fr 1fr 80px 80px' : '1fr 1fr 80px',
          }}
        >
          <span>Ingredient</span>
          <span>Current / Full</span>
          <span className="text-center">Unit</span>
          {isAdmin && <span className="text-center">Actions</span>}
        </div>

        <div className="divide-y divide-gray-50">
          {ingredients.map((item) => {
            const color = stockColor(item.currentStock, item.fullStock);
            return (
              <div
                key={item.id}
                className="grid items-center gap-4 px-4 py-3"
                style={{
                  gridTemplateColumns: isAdmin ? '1fr 1fr 80px 80px' : '1fr 1fr 80px',
                }}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <Circle className="h-3 w-3 shrink-0" style={{ color, fill: color }} />
                  <span className="truncate text-sm font-semibold text-gray-900">{item.name}</span>
                </div>

                {/* Stock */}
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {item.currentStock.toFixed(2)} / {item.fullStock.toFixed(2)}
                  </p>
                  <div className="mt-1">
                    <StockBar current={item.currentStock} full={item.fullStock} />
                  </div>
                </div>

                {/* Unit */}
                <div className="text-center">
                  <span className="text-sm text-gray-500">{item.unit}</span>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="flex items-center justify-center gap-1">
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Stock Modal ─────────────────────────────────────────────────────────

interface EditStockModalProps {
  ingredient: InventoryIngredient | null;
  onClose: () => void;
  onSaved: (updated: InventoryIngredient) => void;
}

function EditStockModal({ ingredient, onClose, onSaved }: EditStockModalProps) {
  const [currentStock, setCurrentStock] = useState('');
  const [fullStock, setFullStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ingredient) {
      setCurrentStock(String(ingredient.currentStock));
      setFullStock(String(ingredient.fullStock));
      setError(null);
    }
  }, [ingredient]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cur = parseFloat(currentStock);
    const full = parseFloat(fullStock);
    if (isNaN(cur) || cur < 0) { setError('Current stock must be a non-negative number.'); return; }
    if (isNaN(full) || full <= 0) { setError('Full stock must be a positive number.'); return; }
    if (!ingredient) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiClient.updateIngredient(ingredient.id, {
        name: ingredient.name,
        unit: ingredient.unit,
        current_stock: cur,
        full_stock: full,
      });
      onSaved(toInventoryIngredient(result));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!ingredient} onClose={onClose} title="Edit Inventory" maxWidth="sm">
      {ingredient && (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ingredient Name</label>
            <input
              type="text"
              value={ingredient.name}
              disabled
              className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
            <input
              type="text"
              value={ingredient.unit}
              disabled
              className={`${inputClass} bg-gray-50 text-gray-500 cursor-not-allowed`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Current Stock <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={currentStock}
                  onChange={(e) => { setCurrentStock(e.target.value); setError(null); }}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Full Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={fullStock}
                onChange={(e) => { setFullStock(e.target.value); setError(null); }}
                className={inputClass}
              />
            </div>
          </div>
          {/* Unit badges */}
          <p className="text-xs text-gray-400">Unit: <span className="font-semibold text-gray-600">{ingredient.unit}</span></p>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving && <Spinner size="sm" className="text-white" />}
              Save
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteModalProps {
  ingredient: InventoryIngredient | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteModal({ ingredient, onClose, onDeleted }: DeleteModalProps) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'ingredient_mgmt' | 'stock_refill' | 'inventory';

export function Inventory() {
  const dispatch = useAppDispatch();
  const role = useAppSelector(selectAuthRole);
  const canRestockPerm = useAppSelector(selectCanRestockInventory);
  const ingredients = useAppSelector(selectInventoryIngredients);

  const isAdmin = canViewIngredientManagement(role);
  const canRestock = role === 'admin' || role === 'manager' || canRestockPerm;

  // Tab visibility mirrors the mobile app:
  // Ingredient Mgmt → admin only
  // Inventory       → admin / manager / chef
  // Stock Refill    → admin / manager / staff+canRestock / chef+canRestock
  const visibleTabs: { id: Tab; label: string }[] = [
    ...(isAdmin ? [{ id: 'ingredient_mgmt' as Tab, label: 'Ingredient Mgmt' }] : []),
    ...(role === 'admin' || role === 'manager' || role === 'chef'
      ? [{ id: 'inventory' as Tab, label: 'Inventory' }]
      : []),
    ...(canRestock ? [{ id: 'stock_refill' as Tab, label: 'Stock Refill' }] : []),
  ];

  const defaultTab = visibleTabs[0]?.id ?? 'stock_refill';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryIngredient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryIngredient | null>(null);

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

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  async function handleRestock(id: string, quantity: number) {
    const result = await apiClient.restockIngredient(id, quantity);
    dispatch(upsertInventoryIngredient(toInventoryIngredient(result)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Manage ingredients, stock levels, and recipes"
      />

      {/* Tab bar */}
      {visibleTabs.length > 1 && (
        <div className="flex rounded-2xl border border-gray-100 bg-white p-1.5 shadow-sm">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? 'border-2 border-primary bg-primary/10 text-primary'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'ingredient_mgmt' ? (
        <IngredientMgmtTab isAdmin={isAdmin} />
      ) : activeTab === 'stock_refill' ? (
        loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
            <button onClick={fetchIngredients} className="ml-3 font-semibold underline">Retry</button>
          </div>
        ) : (
          <StockRefillTab ingredients={ingredients} canRestock={canRestock} onRestock={handleRestock} />
        )
      ) : (
        loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
            <button onClick={fetchIngredients} className="ml-3 font-semibold underline">Retry</button>
          </div>
        ) : (
          <InventoryTab
            ingredients={ingredients}
            isAdmin={isAdmin}
            onEdit={setEditTarget}
            onDelete={setDeleteTarget}
          />
        )
      )}

      {/* Modals */}
      <EditStockModal
        ingredient={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => dispatch(upsertInventoryIngredient(updated))}
      />
      <DeleteModal
        ingredient={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => dispatch(removeInventoryIngredient(id))}
      />
    </div>
  );
}
