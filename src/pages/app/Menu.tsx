import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, Search, BookOpen } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectMenuItems,
  selectMenuCategories,
  setMenuItems,
  addMenuItem,
  updateMenuItem as updateMenuItemAction,
  removeMenuItem,
} from '../../store/menuSlice';
import type { MenuItem } from '../../store/menuSlice';
import { apiClient } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { EmptyState } from '../../components/app/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenuFormValues {
  name: string;
  category: string;
  price: string;
  is_veg: boolean;
  is_available: boolean;
}

const DEFAULT_FORM: MenuFormValues = {
  name: '',
  category: '',
  price: '',
  is_veg: true,
  is_available: true,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function VegBadge({ is_veg }: { is_veg: boolean }) {
  return (
    <span
      title={is_veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`inline-flex h-5 w-5 items-center justify-center rounded-sm border-2 ${
        is_veg ? 'border-green-600' : 'border-red-600'
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${is_veg ? 'bg-green-600' : 'bg-red-600'}`}
      />
    </span>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
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
  const categories = useAppSelector(selectMenuCategories);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtering
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<MenuFormValues>(DEFAULT_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggling availability inline
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .listMenuItems()
      .then((data) => {
        if (!cancelled) dispatch(setMenuItems(data));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load menu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = items.filter((item) => {
    const matchesSearch =
      search.trim() === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === 'All' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAdd = useCallback(() => {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: MenuItem) => {
    setEditTarget(item);
    setForm({
      name: item.name,
      category: item.category,
      price: String(item.price),
      is_veg: item.is_veg,
      is_available: item.is_available,
    });
    setFormError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (formLoading) return;
    setModalOpen(false);
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
  }, [formLoading]);

  // ── Form submit ─────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const priceNum = parseFloat(form.price);
      if (!form.name.trim()) {
        setFormError('Name is required.');
        return;
      }
      if (!form.category.trim()) {
        setFormError('Category is required.');
        return;
      }
      if (isNaN(priceNum) || priceNum < 0) {
        setFormError('Enter a valid price.');
        return;
      }

      const payload: Partial<MenuItem> = {
        name: form.name.trim(),
        category: form.category.trim(),
        price: priceNum,
        is_veg: form.is_veg,
        is_available: form.is_available,
      };

      setFormLoading(true);
      try {
        if (editTarget) {
          const updated = await apiClient.updateMenuItem(editTarget.id, payload);
          dispatch(updateMenuItemAction(updated));
        } else {
          const created = await apiClient.createMenuItem(payload);
          dispatch(addMenuItem(created));
        }
        closeModal();
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setFormLoading(false);
      }
    },
    [form, editTarget, dispatch, closeModal]
  );

  // ── Availability toggle ─────────────────────────────────────────────────────

  const handleToggleAvailability = useCallback(
    async (item: MenuItem) => {
      if (togglingId === item.id) return;
      setTogglingId(item.id);
      try {
        const updated = await apiClient.updateMenuItem(item.id, {
          is_available: !item.is_available,
        });
        dispatch(updateMenuItemAction(updated));
      } catch {
        // silently fail — item stays at old value in Redux
      } finally {
        setTogglingId(null);
      }
    },
    [dispatch, togglingId]
  );

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiClient.deleteMenuItem(deleteTarget.id);
      dispatch(removeMenuItem(deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      // Keep the confirm modal open on error so the user sees it
      console.error('[Menu] delete failed', err);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget, dispatch]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Menu"
        subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}
        action={
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="h-4 w-4" />
            Add item
          </button>
        }
      />

      {/* Search + category filter */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={search || activeCategory !== 'All' ? 'No items match your filter' : 'No menu items yet'}
          description={
            search || activeCategory !== 'All'
              ? 'Try a different search or category.'
              : 'Add your first menu item to get started.'
          }
          action={
            !search && activeCategory === 'All' ? (
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Available</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="group hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{item.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{item.category}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    ₹{item.price.toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <VegBadge is_veg={item.is_veg} />
                      <span className={item.is_veg ? 'text-green-700' : 'text-red-700'}>
                        {item.is_veg ? 'Veg' : 'Non-veg'}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Toggle
                      checked={item.is_available}
                      onChange={() => handleToggleAvailability(item)}
                      disabled={togglingId === item.id}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editTarget ? 'Edit item' : 'Add item'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Paneer Butter Masala"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
            <input
              type="text"
              list="category-suggestions"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Main Course"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <datalist id="category-suggestions">
              {categories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Price (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Vegetarian</p>
              <p className="text-xs text-gray-400">Mark if this item is veg</p>
            </div>
            <Toggle
              checked={form.is_veg}
              onChange={(val) => setForm((f) => ({ ...f, is_veg: val }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Available</p>
              <p className="text-xs text-gray-400">Customers can order this item</p>
            </div>
            <Toggle
              checked={form.is_available}
              onChange={(val) => setForm((f) => ({ ...f, is_available: val }))}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={closeModal}
              disabled={formLoading}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {formLoading && <Spinner size="sm" className="text-white" />}
              {editTarget ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !deleteLoading && setDeleteTarget(null)}
        title="Delete item?"
        maxWidth="sm"
      >
        <p className="mb-6 text-sm text-gray-600">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{deleteTarget?.name}</span>? This cannot
          be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeleteTarget(null)}
            disabled={deleteLoading}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {deleteLoading && <Spinner size="sm" className="text-white" />}
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
