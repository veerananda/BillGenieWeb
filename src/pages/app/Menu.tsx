import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Leaf,
  Beef,
  Pencil,
  Trash2,
  Plus,
  Search,
  BookOpen,
  Zap,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectCanManageMenu } from '../../store/authSlice';
import {
  selectMenuItems,
  setMenuItems,
  updateMenuItem as updateMenuItemAction,
  removeMenuItem,
} from '../../store/menuSlice';
import type { MenuItem } from '../../store/menuSlice';
import { apiClient } from '../../services/api';
import type { MenuVariantWrite } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { EmptyState } from '../../components/app/EmptyState';
import {
  DEFAULT_MENU_CHANNELS,
  MENU_CHANNELS,
  normalizeChannelPrices,
  normalizeMenuChannels,
  toggleMenuChannel,
  type ChannelPrices,
  type MenuChannelId,
} from '../../lib/menuChannels';

// ── Types ─────────────────────────────────────────────────────────────────────

type DietFilter = 'all' | 'veg' | 'nonveg';

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface PortionDraft {
  id?: string;
  label: string;
  price: string;
  recipe_scale: string;
  /** Channel id → price text for this extra portion. */
  channel_prices: Record<string, string>;
}

const DEFAULT_PORTION_LABEL = 'Full';

function isDefaultPortionLabel(label: string) {
  const t = label.trim().toLowerCase();
  return !t || t === 'regular' || t === 'full';
}

function parseChannelPriceMap(
  channels: MenuChannelId[],
  prices: Record<string, string> | undefined,
  fallback: number
): ChannelPrices {
  const raw: Record<string, number> = {};
  for (const ch of channels) {
    const text = prices?.[ch];
    if (text !== undefined && String(text).trim() !== '') {
      const n = parseFloat(String(text));
      if (Number.isFinite(n) && n >= 0) raw[ch] = n;
    }
  }
  return normalizeChannelPrices(channels, raw, fallback);
}

function applyChannelToggleToPortions(
  portions: PortionDraft[],
  channel: MenuChannelId,
  enabled: boolean,
  basePrice: number
): PortionDraft[] {
  return portions.map((portion) => {
    const next = { ...(portion.channel_prices || {}) };
    if (!enabled) {
      delete next[channel];
      return { ...portion, channel_prices: next };
    }
    if (next[channel] === undefined || String(next[channel]).trim() === '') {
      next[channel] = portion.price || (basePrice >= 0 ? String(basePrice) : '0');
    }
    return { ...portion, channel_prices: next };
  });
}

function buildVariantsPayload(
  price: number,
  portions: PortionDraft[],
  channels: MenuChannelId[],
  regularChannelPrices: ChannelPrices,
  regularId?: string
): MenuVariantWrite[] {
  const extras = portions
    .map((p, i) => {
      const label = p.label.trim();
      const portionPrice = parseFloat(p.price);
      const scale = parseFloat(p.recipe_scale) || 1;
      const unitPrice = Number.isFinite(portionPrice) && portionPrice >= 0 ? portionPrice : NaN;
      return {
        id: p.id,
        label,
        price: unitPrice,
        recipe_scale: scale,
        sort_order: i + 1,
        channel_prices: parseChannelPriceMap(
          channels,
          p.channel_prices,
          Number.isFinite(unitPrice) ? unitPrice : price
        ),
      };
    })
    .filter((p) => p.label && !isDefaultPortionLabel(p.label) && !isNaN(p.price) && p.price >= 0);

  return [
    {
      ...(regularId ? { id: regularId } : {}),
      label: DEFAULT_PORTION_LABEL,
      price,
      recipe_scale: 1,
      channel_prices: normalizeChannelPrices(channels, regularChannelPrices, price),
      is_default: true,
      sort_order: 0,
    },
    ...extras.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      label: p.label,
      price: p.price,
      recipe_scale: p.recipe_scale,
      channel_prices: p.channel_prices,
      is_default: false,
      sort_order: p.sort_order,
    })),
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(items: MenuItem[]): MenuCategory[] {
  const map = new Map<string, MenuItem[]>();
  for (const item of items) {
    const cat = item.category || 'Uncategorized';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
}

function matchesDiet(item: MenuItem, filter: DietFilter) {
  if (filter === 'veg') return item.is_veg;
  if (filter === 'nonveg') return !item.is_veg;
  return true;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VegBadge({ is_veg }: { is_veg: boolean }) {
  return is_veg ? (
    <Leaf size={13} className="text-green-600 shrink-0" />
  ) : (
    <Beef size={13} className="text-red-600 shrink-0" />
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Menu() {
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectMenuItems);
  const canManageMenu = useAppSelector(selectCanManageMenu);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Search + diet filter
  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<DietFilter>('all');

  // Accordion expand state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Local-only empty categories (not yet in API)
  const [localOnlyCategories, setLocalOnlyCategories] = useState<string[]>([]);

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalEditName, setCatModalEditName] = useState<string | null>(null); // null = add new
  const [catInput, setCatInput] = useState('');
  const [catModalError, setCatModalError] = useState('');
  const [catModalLoading, setCatModalLoading] = useState(false);

  // Item modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalCategory, setItemModalCategory] = useState('');
  const [itemEditTarget, setItemEditTarget] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemVeg, setItemVeg] = useState(false);
  const [itemAvailable, setItemAvailable] = useState(true);
  const [itemChannels, setItemChannels] = useState<MenuChannelId[]>([...DEFAULT_MENU_CHANNELS]);
  const [itemChannelPrices, setItemChannelPrices] = useState<ChannelPrices>({});
  const [itemReadilyAvailable, setItemReadilyAvailable] = useState(false);
  const [itemTaxable, setItemTaxable] = useState(true);
  const [itemPortions, setItemPortions] = useState<PortionDraft[]>([]);
  const [itemRegularVariantId, setItemRegularVariantId] = useState<string | undefined>();
  const [itemModalError, setItemModalError] = useState('');
  const [itemModalLoading, setItemModalLoading] = useState(false);

  // Delete state
  const [deleteCatTarget, setDeleteCatTarget] = useState<string | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggling availability
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    apiClient
      .listMenuItems()
      .then((data) => { if (!cancelled) dispatch(setMenuItems(data)); })
      .catch((err: unknown) => { if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load menu'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dispatch]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const categories: MenuCategory[] = useMemo(() => {
    const fromItems = groupByCategory(items);
    const existingNames = new Set(fromItems.map((c) => c.name));
    const extras = localOnlyCategories
      .filter((n) => !existingNames.has(n))
      .map((name) => ({ name, items: [] as MenuItem[] }));
    return [...fromItems, ...extras];
  }, [items, localOnlyCategories]);

  const allCategoryNames = useMemo(() => categories.map((c) => c.name), [categories]);

  // Search results (flat list across all categories + diet filter)
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return items
      .filter(
        (item) =>
          matchesDiet(item, dietFilter) &&
          (item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, dietFilter]);

  // ── Category modal ──────────────────────────────────────────────────────────

  function openAddCategory() {
    setCatModalEditName(null);
    setCatInput('');
    setCatModalError('');
    setCatModalOpen(true);
  }

  function openEditCategory(name: string) {
    setCatModalEditName(name);
    setCatInput(name);
    setCatModalError('');
    setCatModalOpen(true);
  }

  function closeCatModal() {
    if (catModalLoading) return;
    setCatModalOpen(false);
    setCatModalEditName(null);
    setCatInput('');
    setCatModalError('');
  }

  async function handleCatSubmit() {
    const trimmed = catInput.trim();
    if (!trimmed) { setCatModalError('Enter a category name.'); return; }

    if (catModalEditName === null) {
      // Add new
      const exists = allCategoryNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
      if (exists) { setCatModalError('Category already exists.'); return; }
      setLocalOnlyCategories((prev) => [...prev, trimmed]);
      setExpandedCategory(trimmed);
      closeCatModal();
    } else {
      // Rename — update all items in this category via API
      const cat = categories.find((c) => c.name === catModalEditName);
      if (!cat || cat.items.length === 0) {
        // Local-only category rename
        setLocalOnlyCategories((prev) => prev.map((n) => (n === catModalEditName ? trimmed : n)));
        if (expandedCategory === catModalEditName) setExpandedCategory(trimmed);
        closeCatModal();
        return;
      }
      const duplicate = allCategoryNames.some(
        (n) => n !== catModalEditName && n.toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) { setCatModalError('Category already exists.'); return; }
      setCatModalLoading(true);
      try {
        await Promise.all(
          cat.items.map((item) => apiClient.updateMenuItem(item.id, { category: trimmed }))
        );
        // Refresh all items
        const fresh = await apiClient.listMenuItems();
        dispatch(setMenuItems(fresh));
        if (expandedCategory === catModalEditName) setExpandedCategory(trimmed);
        closeCatModal();
      } catch {
        setCatModalError('Failed to rename category.');
      } finally {
        setCatModalLoading(false);
      }
    }
  }

  // ── Delete category ─────────────────────────────────────────────────────────

  async function handleDeleteCategory() {
    if (!deleteCatTarget) return;
    setDeleteLoading(true);
    const cat = categories.find((c) => c.name === deleteCatTarget);
    try {
      if (cat && cat.items.length > 0) {
        await Promise.all(cat.items.map((item) => apiClient.deleteMenuItem(item.id)));
        const fresh = await apiClient.listMenuItems();
        dispatch(setMenuItems(fresh));
      }
      setLocalOnlyCategories((prev) => prev.filter((n) => n !== deleteCatTarget));
      setDeleteCatTarget(null);
    } catch {
      // keep modal open on error
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Item modal ──────────────────────────────────────────────────────────────

  function openAddItem(categoryName: string) {
    setItemEditTarget(null);
    setItemModalCategory(categoryName);
    setItemName('');
    setItemPrice('');
    setItemVeg(false);
    setItemAvailable(true);
    setItemChannels([...DEFAULT_MENU_CHANNELS]);
    setItemChannelPrices({});
    setItemReadilyAvailable(false);
    setItemTaxable(true);
    setItemPortions([]);
    setItemRegularVariantId(undefined);
    setItemModalError('');
    setItemModalOpen(true);
  }

  function openEditItem(item: MenuItem) {
    setItemEditTarget(item);
    setItemModalCategory(item.category);
    setItemName(item.name);
    const variants = [...(item.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const defaultVariant =
      variants.find((v) => v.is_default) ??
      variants.find((v) => isDefaultPortionLabel(v.label)) ??
      variants[0];
    setItemPrice(String(defaultVariant?.price ?? item.price));
    setItemRegularVariantId(
      defaultVariant && (defaultVariant.is_default || isDefaultPortionLabel(defaultVariant.label))
        ? defaultVariant.id
        : undefined
    );
    const channels = normalizeMenuChannels(item.available_channels);
    const base = Number(defaultVariant?.price ?? item.price) || 0;
    setItemPortions(
      variants
        .filter((v) => v.id !== defaultVariant?.id && !isDefaultPortionLabel(v.label))
        .map((v) => {
          const map = v.channel_prices;
          const portionBase = Number(v.price) || 0;
          const channel_prices: Record<string, string> = {};
          for (const ch of channels) {
            const fromVariant = map?.[ch];
            channel_prices[ch] =
              typeof fromVariant === 'number' && Number.isFinite(fromVariant)
                ? String(fromVariant)
                : String(portionBase || '');
          }
          return {
            id: v.id,
            label: v.label,
            price: String(v.price),
            recipe_scale: String(v.recipe_scale ?? 1),
            channel_prices,
          };
        })
    );
    setItemVeg(item.is_veg);
    setItemAvailable(item.is_available);
    setItemChannels(channels);
    // Prefer Full variant channel_prices when present; fall back to item-level map.
    const defaultChannelMap =
      defaultVariant?.channel_prices && Object.keys(defaultVariant.channel_prices).length > 0
        ? defaultVariant.channel_prices
        : item.channel_prices;
    setItemChannelPrices(normalizeChannelPrices(channels, defaultChannelMap, base));
    setItemReadilyAvailable(item.readily_available ?? false);
    setItemTaxable(item.is_taxable !== false);
    setItemModalError('');
    setItemModalOpen(true);
  }

  function closeItemModal() {
    if (itemModalLoading) return;
    setItemModalOpen(false);
    setItemEditTarget(null);
    setItemPortions([]);
    setItemRegularVariantId(undefined);
    setItemModalError('');
  }

  async function handleItemSubmit() {
    const name = itemName.trim();
    const price = parseFloat(itemPrice);
    if (!name) { setItemModalError('Item name is required.'); return; }
    if (isNaN(price) || price < 0) { setItemModalError('Enter a valid price.'); return; }

    for (const portion of itemPortions) {
      const label = portion.label.trim();
      const portionPrice = parseFloat(portion.price);
      const scale = parseFloat(portion.recipe_scale);
      if (!label) { setItemModalError('Each portion needs a label.'); return; }
      if (isDefaultPortionLabel(label)) {
        setItemModalError('Use the Price field for Full; add other portions (e.g. Half) below.');
        return;
      }
      if (isNaN(portionPrice) || portionPrice < 0) { setItemModalError(`Enter a valid price for "${label}".`); return; }
      if (isNaN(scale) || scale <= 0) { setItemModalError(`Enter a valid recipe scale for "${label}".`); return; }
    }

    const variants = buildVariantsPayload(
      price,
      itemPortions,
      itemChannels,
      itemChannelPrices,
      itemRegularVariantId
    );
    const channelPrices = normalizeChannelPrices(itemChannels, itemChannelPrices, price);

    setItemModalLoading(true);
    try {
      if (itemEditTarget) {
        const updated = await apiClient.updateMenuItem(itemEditTarget.id, {
          name,
          price,
          is_veg: itemVeg,
          is_available: itemAvailable,
          available_channels: itemChannels,
          channel_prices: channelPrices,
          readily_available: itemReadilyAvailable,
          is_taxable: itemTaxable,
          variants,
        });
        dispatch(updateMenuItemAction(updated));
      } else {
        await apiClient.createMenuItem({
          name,
          price,
          is_veg: itemVeg,
          is_available: itemAvailable,
          available_channels: itemChannels,
          channel_prices: channelPrices,
          readily_available: itemReadilyAvailable,
          is_taxable: itemTaxable,
          category: itemModalCategory,
          variants,
        });
        // Remove from local-only if it was empty
        setLocalOnlyCategories((prev) => prev.filter((n) => n !== itemModalCategory));
        const fresh = await apiClient.listMenuItems();
        dispatch(setMenuItems(fresh));
      }
      closeItemModal();
    } catch (err: unknown) {
      setItemModalError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setItemModalLoading(false);
    }
  }

  // ── Availability toggle ─────────────────────────────────────────────────────

  const handleToggleAvailability = useCallback(
    async (item: MenuItem) => {
      if (togglingId === item.id) return;
      setTogglingId(item.id);
      try {
        const updated = await apiClient.updateMenuItem(item.id, { is_available: !item.is_available });
        dispatch(updateMenuItemAction(updated));
      } finally {
        setTogglingId(null);
      }
    },
    [dispatch, togglingId]
  );

  // ── Delete item ─────────────────────────────────────────────────────────────

  async function handleDeleteItem() {
    if (!deleteItemTarget) return;
    setDeleteLoading(true);
    try {
      await apiClient.deleteMenuItem(deleteItemTarget.id);
      dispatch(removeMenuItem(deleteItemTarget.id));
      setDeleteItemTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const dietButtons: { label: string; value: DietFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Veg', value: 'veg' },
    { label: 'Non-Veg', value: 'nonveg' },
  ];

  return (
    <div>
      <PageHeader
        title="Menu Management"
        subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}
        action={
          canManageMenu ? (
          <button
            onClick={openAddCategory}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add category
          </button>
          ) : undefined
        }
      />

      {/* Search + diet filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          {dietButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setDietFilter(btn.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                dietFilter === btn.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-gray-500">
        Turn off <span className="font-medium">Available</span> to hide an item from Take Order and Counter when it is sold out or not served today.
      </p>

      {/* Main content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {fetchError}
        </div>
      ) : searchResults !== null ? (
        /* ── Search results ── */
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </div>
          {searchResults.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No items match your search</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {searchResults.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  togglingId={togglingId}
                  onToggle={handleToggleAvailability}
                  onEdit={openEditItem}
                  onDelete={setDeleteItemTarget}
                  showCategory
                  canManageMenu={canManageMenu}
                />
              ))}
            </div>
          )}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No menu categories yet"
          description={canManageMenu ? 'Add a category, then add items within it.' : 'No menu items to manage yet.'}
          action={
            canManageMenu ? (
            <button
              onClick={openAddCategory}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Add category
            </button>
            ) : undefined
          }
        />
      ) : (
        /* ── Category accordions ── */
        <div className="space-y-3">
          {categories
            .filter((cat) => dietFilter === 'all' || cat.items.some((item) => matchesDiet(item, dietFilter)))
            .map((cat) => {
            const isExpanded = expandedCategory === cat.name;
            const visibleItems = cat.items.filter((item) => matchesDiet(item, dietFilter));
            return (
              <div
                key={cat.name}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 ${isExpanded ? 'border-b border-gray-100' : ''}`}
                >
                  <span className="text-primary">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-900">{cat.name}</span>
                  <span className="mr-2 text-xs text-gray-400">{cat.items.length} item{cat.items.length !== 1 ? 's' : ''}</span>
                  {canManageMenu && (
                  <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEditCategory(cat.name); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Rename category"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteCatTarget(cat.name); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Delete category"
                  >
                    <Trash2 size={14} />
                  </button>
                  </>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    {/* Types / Flavours header */}
                    <div className="flex items-center justify-between border-b border-gray-100 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Types / Flavours
                      </span>
                      {canManageMenu && (
                      <button
                        type="button"
                        onClick={() => openAddItem(cat.name)}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                      >
                        <Plus size={12} /> Add item
                      </button>
                      )}
                    </div>

                    {/* Items */}
                    {visibleItems.length === 0 ? (
                      <p className="py-4 text-center text-xs text-gray-400">
                        {cat.items.length === 0
                          ? 'No items yet — click Add item to get started'
                          : 'No items for this filter'}
                      </p>
                    ) : (
                      <div className="mt-1 divide-y divide-gray-50">
                        {visibleItems.map((item) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            togglingId={togglingId}
                            onToggle={handleToggleAvailability}
                            onEdit={openEditItem}
                            onDelete={setDeleteItemTarget}
                            canManageMenu={canManageMenu}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Category modal ── */}
      <Modal
        open={catModalOpen}
        onClose={closeCatModal}
        title={catModalEditName ? 'Edit Category' : 'Add New Category'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          {catModalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {catModalError}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Category name</label>
            <input
              type="text"
              autoFocus
              value={catInput}
              onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCatSubmit(); }}
              placeholder="e.g. Starters, Main Course, Beverages"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeCatModal}
              disabled={catModalLoading}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCatSubmit}
              disabled={catModalLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {catModalLoading && <Spinner size="sm" className="text-white" />}
              {catModalEditName ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Item add/edit modal ── */}
      <Modal
        open={itemModalOpen}
        onClose={closeItemModal}
        title={itemEditTarget ? 'Edit menu item' : 'Add menu item'}
        maxWidth="sm"
      >
        <div className="space-y-4">
          {itemModalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {itemModalError}
            </div>
          )}

          {/* Category chip — read-only context */}
          <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {itemModalCategory}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Item name</label>
            <input
              type="text"
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Paneer Butter Masala"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Price (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={itemPrice}
              onChange={(e) => setItemPrice(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-400">Full / default portion price</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Extra portions</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Optional (Half, Family). Scale multiplies ingredient stock use (0.5 / 2).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const basePrice = parseFloat(itemPrice);
                  const seeded: Record<string, string> = {};
                  for (const ch of itemChannels) {
                    seeded[ch] =
                      itemChannelPrices[ch] !== undefined
                        ? String(itemChannelPrices[ch])
                        : Number.isFinite(basePrice) && basePrice >= 0
                          ? String(basePrice)
                          : '';
                  }
                  setItemPortions((prev) => [
                    ...prev,
                    { label: '', price: '', recipe_scale: '1', channel_prices: seeded },
                  ]);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {itemPortions.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 px-0.5">
                  <span className="min-w-[5.5rem] flex-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Portion
                  </span>
                  <span className="w-24 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Price
                  </span>
                  <span className="w-24 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Scale
                  </span>
                  <span className="w-8" aria-hidden />
                </div>
                {itemPortions.map((portion, index) => (
                  <div key={portion.id ?? `new-${index}`} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-[5.5rem] flex-1">
                      <input
                        type="text"
                        value={portion.label}
                        onChange={(e) =>
                          setItemPortions((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, label: e.target.value } : p))
                          )
                        }
                        placeholder="Half"
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={portion.price}
                        onChange={(e) =>
                          setItemPortions((prev) =>
                            prev.map((p, i) => (i === index ? { ...p, price: e.target.value } : p))
                          )
                        }
                        placeholder="0"
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={portion.recipe_scale}
                        onChange={(e) =>
                          setItemPortions((prev) =>
                            prev.map((p, i) =>
                              i === index ? { ...p, recipe_scale: e.target.value } : p
                            )
                          )
                        }
                        placeholder="0.5"
                        title="How much of the dish recipe to use (Half = 0.5, Family = 2)"
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setItemPortions((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      title="Remove portion"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-700">Vegetarian</p>
            <Toggle checked={itemVeg} onChange={() => setItemVeg((v) => !v)} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-700">Available</p>
            <Toggle checked={itemAvailable} onChange={() => setItemAvailable((v) => !v)} />
          </div>

          <div
            className={`rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-3 ${
              !itemAvailable ? 'opacity-50' : ''
            }`}
          >
            <p className="text-sm font-medium text-gray-700">Available on</p>
            <div className="flex flex-wrap gap-2">
              {MENU_CHANNELS.map((channel) => {
                const selected = itemChannels.includes(channel.id);
                const basePrice = parseFloat(itemPrice);
                return (
                  <button
                    key={channel.id}
                    type="button"
                    disabled={!itemAvailable}
                    onClick={() => {
                      const next = toggleMenuChannel(
                        itemChannels,
                        channel.id,
                        itemChannelPrices,
                        Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0
                      );
                      const turningOn = next.channels.includes(channel.id);
                      setItemPortions((prev) =>
                        applyChannelToggleToPortions(
                          prev,
                          channel.id,
                          turningOn,
                          Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0
                        )
                      );
                      setItemChannels(next.channels);
                      setItemChannelPrices(next.prices);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                      selected
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {channel.label}
                  </button>
                );
              })}
            </div>
            {itemChannels.length > 0 ? (
              itemPortions.length === 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {itemChannels.map((channelId) => {
                    const meta = MENU_CHANNELS.find((c) => c.id === channelId);
                    return (
                      <div key={channelId} className="min-w-0">
                        <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                          {meta?.label ?? channelId}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={!itemAvailable}
                          value={itemChannelPrices[channelId] ?? ''}
                          placeholder={itemPrice || '0'}
                          onChange={(e) => {
                            const n = parseFloat(e.target.value);
                            setItemChannelPrices((prev) => ({
                              ...prev,
                              [channelId]: Number.isFinite(n) ? n : 0,
                            }));
                          }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-500">Channel prices by portion</p>
                  {itemChannels.map((channelId) => {
                    const meta = MENU_CHANNELS.find((c) => c.id === channelId);
                    return (
                      <div
                        key={channelId}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 space-y-2"
                      >
                        <p className="text-xs font-bold text-gray-800">{meta?.label ?? channelId}</p>
                        <div className="flex flex-wrap gap-2">
                          <div className="w-[5.5rem]">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              Full
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              disabled={!itemAvailable}
                              value={itemChannelPrices[channelId] ?? ''}
                              placeholder={itemPrice || '0'}
                              onChange={(e) => {
                                const n = parseFloat(e.target.value);
                                setItemChannelPrices((prev) => ({
                                  ...prev,
                                  [channelId]: Number.isFinite(n) ? n : 0,
                                }));
                              }}
                              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                          </div>
                          {itemPortions.map((portion, index) => (
                            <div key={`${channelId}-${portion.id ?? index}`} className="w-[5.5rem]">
                              <label className="mb-1 block truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                {portion.label.trim() || `P${index + 1}`}
                              </label>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                disabled={!itemAvailable}
                                value={portion.channel_prices?.[channelId] ?? ''}
                                placeholder={portion.price || '0'}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setItemPortions((prev) =>
                                    prev.map((p, i) =>
                                      i === index
                                        ? {
                                            ...p,
                                            channel_prices: {
                                              ...p.channel_prices,
                                              [channelId]: text,
                                            },
                                          }
                                        : p
                                    )
                                  );
                                }}
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Taxable</p>
              <Toggle checked={itemTaxable} onChange={() => setItemTaxable((v) => !v)} />
            </div>
            <p className="text-xs text-gray-400">
              Turn off for MRP items like water bottles that are already taxed at purchase.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-medium text-gray-700">Ready to serve</p>
              </div>
              <Toggle checked={itemReadilyAvailable} onChange={() => setItemReadilyAvailable((v) => !v)} />
            </div>
            <p className="text-xs text-gray-400">
              No kitchen prep needed (e.g. water bottle, packaged snacks). These items skip the kitchen queue and show as ready to serve for staff to confirm.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={closeItemModal}
              disabled={itemModalLoading}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleItemSubmit}
              disabled={itemModalLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {itemModalLoading && <Spinner size="sm" className="text-white" />}
              {itemEditTarget ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Delete category confirm ── */}
      <Modal
        open={!!deleteCatTarget}
        onClose={() => !deleteLoading && setDeleteCatTarget(null)}
        title="Delete category?"
        maxWidth="sm"
      >
        <p className="mb-6 text-sm text-gray-600">
          Delete <span className="font-semibold text-gray-900">"{deleteCatTarget}"</span>?
          {' '}This will permanently delete all items in this category.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteCatTarget(null)}
            disabled={deleteLoading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteCategory}
            disabled={deleteLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {deleteLoading && <Spinner size="sm" className="text-white" />}
            Delete
          </button>
        </div>
      </Modal>

      {/* ── Delete item confirm ── */}
      <Modal
        open={!!deleteItemTarget}
        onClose={() => !deleteLoading && setDeleteItemTarget(null)}
        title="Delete item?"
        maxWidth="sm"
      >
        <p className="mb-6 text-sm text-gray-600">
          Delete <span className="font-semibold text-gray-900">"{deleteItemTarget?.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteItemTarget(null)}
            disabled={deleteLoading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteItem}
            disabled={deleteLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {deleteLoading && <Spinner size="sm" className="text-white" />}
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── ItemRow sub-component ─────────────────────────────────────────────────────

function ItemRow({
  item,
  togglingId,
  onToggle,
  onEdit,
  onDelete,
  showCategory,
  canManageMenu = true,
}: {
  item: MenuItem;
  togglingId: string | null;
  onToggle: (item: MenuItem) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  showCategory?: boolean;
  canManageMenu?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-3 pl-1 pr-0 ${
        !item.is_available ? 'opacity-60' : ''
      }`}
    >
      {/* Left availability indicator */}
      <div
        className={`h-8 w-1 shrink-0 rounded-full ${
          item.is_available ? 'bg-primary' : 'bg-gray-300'
        }`}
      />

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold text-gray-900 truncate ${
            !item.is_available ? 'line-through text-gray-400' : ''
          }`}
        >
          {item.name}
        </p>
        {item.variants && item.variants.length > 1 && (
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {[...item.variants]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((v) => v.label)
              .join(' · ')}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">
            ₹{item.price.toLocaleString('en-IN')}
          </span>
          <VegBadge is_veg={item.is_veg} />
          {item.readily_available && (
            <span title="Ready to serve — skips kitchen" className="inline-flex items-center gap-0.5 text-xs text-amber-600">
              <Zap size={10} />
              Ready
            </span>
          )}
          {showCategory && (
            <span className="text-xs text-gray-400">{item.category}</span>
          )}
        </div>
      </div>

      {/* Toggle */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-[10px] font-semibold ${item.is_available ? 'text-gray-500' : 'text-gray-400'}`}>
          {item.is_available ? 'Available' : 'Unavailable'}
        </span>
        <Toggle
          checked={item.is_available}
          onChange={() => onToggle(item)}
          disabled={togglingId === item.id}
        />
      </div>

      {/* Actions */}
      {canManageMenu && (
      <>
      <button
        type="button"
        onClick={() => onEdit(item)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Edit"
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        onClick={() => onDelete(item)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
        title="Delete"
      >
        <Trash2 size={15} />
      </button>
      </>
      )}
    </div>
  );
}
