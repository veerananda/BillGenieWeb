import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { formatInr } from '../../data/pricing';
import {
  buildExpenseMonthOptions,
  currentExpenseMonthKey,
} from '../../lib/expenseMonths';

function formatMoney(amount: number): string {
  return formatInr(amount);
}

export function Expenses() {
  const role = useAppSelector(selectAuthRole);
  const profile = useAppSelector(selectProfile);
  const allowed = role === 'admin' || role === 'manager';

  const monthOptions = useMemo(
    () => buildExpenseMonthOptions((profile as { created_at?: string } | null)?.created_at),
    [profile]
  );

  const [selectedKey, setSelectedKey] = useState(currentExpenseMonthKey);
  const selected = monthOptions.find((o) => o.key === selectedKey) ?? monthOptions[0];
  const isCurrentMonth = selected?.key === currentExpenseMonthKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [expenses, setExpenses] = useState<
    Array<{ id: string; name: string; amount: number; created_at: string }>
  >([]);
  const [manualTotal, setManualTotal] = useState(0);
  const [stockTotal, setStockTotal] = useState(0);
  const [total, setTotal] = useState(0);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listExpenses(year, month);
      setExpenses(data.expenses);
      setManualTotal(data.manual_total);
      setStockTotal(data.stock_total);
      setTotal(data.total);
      setPeriodLabel(data.period_label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed || !selected) return;
    void load(selected.year, selected.month);
  }, [allowed, load, selected?.year, selected?.month]);

  if (!allowed) {
    return <Navigate to="/app/orders" replace />;
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!isCurrentMonth) {
      setFormError('Switch to the current month to add a new expense.');
      return;
    }
    const trimmed = name.trim();
    const value = parseFloat(amount.trim());
    if (!trimmed) {
      setFormError('Enter an expense name.');
      return;
    }
    if (!amount.trim() || Number.isNaN(value) || value <= 0) {
      setFormError('Enter an amount greater than 0.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiClient.createExpense({ name: trimmed, amount: value });
      setName('');
      setAmount('');
      if (selected) await load(selected.year, selected.month);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add expense.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.deleteExpense(id);
      if (selected) await load(selected.year, selected.month);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense.');
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Expenses"
        subtitle="Monthly costs and stock refill spend · each new month starts at ₹0"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="expense-month" className="text-sm font-semibold text-gray-700">
          Month
        </label>
        <select
          id="expense-month"
          value={selected?.key ?? selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {monthOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            onClick={() => selected && void load(selected.year, selected.month)}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total · {periodLabel || selected?.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(total)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Manual expenses</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatMoney(manualTotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stock refill</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatMoney(stockTotal)}</p>
            </div>
          </div>

          {isCurrentMonth ? (
            <form
              onSubmit={(e) => void handleAdd(e)}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <h3 className="mb-3 text-sm font-bold text-gray-900">Add expense</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setFormError(null);
                    setName(e.target.value);
                  }}
                  placeholder="Expense name (e.g. Rent, Gas, Electricity)"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setFormError(null);
                    setAmount(e.target.value);
                  }}
                  placeholder="Amount ₹"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Spinner size="sm" className="text-white" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
              </div>
              {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
            </form>
          ) : (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Viewing history for {periodLabel || selected?.label}. Switch to the current month to add expenses.
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">
                Expenses · {periodLabel || selected?.label}
              </h3>
              <p className="text-xs text-gray-500">
                Manual entries only — stock spend is tracked from Stock Refill.
              </p>
            </div>
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Wallet className="mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">
                  No manual expenses for {periodLabel || selected?.label || 'this month'}.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {expenses.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{formatMoney(item.amount)}</p>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
