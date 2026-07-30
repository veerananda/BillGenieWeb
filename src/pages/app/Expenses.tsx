import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Wallet, FileText, Share2, Download } from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { formatInr } from '../../data/pricing';
import {
  hasExpensesAccess,
  parseSubscriptionLimits,
} from '../../lib/subscriptionLimits';
import {
  buildExpenseMonthOptions,
  currentExpenseMonthKey,
} from '../../lib/expenseMonths';
import {
  buildExpenseMonthReportHtml,
  buildExpenseMonthReportText,
  type ExpenseMonthReport,
} from '../../lib/expenseMonthReport';
import { printBillHtml } from '../../lib/customerBillFormat';

function formatMoney(amount: number): string {
  return formatInr(amount);
}

export function Expenses() {
  const role = useAppSelector(selectAuthRole);
  const profile = useAppSelector(selectProfile);
  const roleAllowed = role === 'admin' || role === 'manager';
  const limits = parseSubscriptionLimits(
    (profile?.subscription_limits as unknown as Record<string, unknown>) ?? null
  );
  const expensesOnPlan = hasExpensesAccess(limits);
  const allowed = roleAllowed && expensesOnPlan;

  const monthOptions = useMemo(
    () => buildExpenseMonthOptions(profile?.created_at),
    [profile?.created_at]
  );

  const [selectedKey, setSelectedKey] = useState(() => currentExpenseMonthKey());
  const selected =
    monthOptions.find((o) => o.key === selectedKey) ??
    monthOptions.find((o) => o.key === currentExpenseMonthKey()) ??
    monthOptions[0];
  const isCurrentMonth = selected?.key === currentExpenseMonthKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [expenses, setExpenses] = useState<
    Array<{ id: string; name: string; amount: number; created_at: string }>
  >([]);
  const [total, setTotal] = useState(0);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState<ExpenseMonthReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listExpenses(year, month);
      setExpenses(data.expenses);
      setTotal(data.manual_total ?? data.total);
      setPeriodLabel(data.period_label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!monthOptions.length) return;
    if (!monthOptions.some((o) => o.key === selectedKey)) {
      setSelectedKey(currentExpenseMonthKey());
    }
  }, [monthOptions, selectedKey]);

  useEffect(() => {
    if (!allowed || !selected) return;
    void load(selected.year, selected.month);
  }, [allowed, load, selected?.year, selected?.month]);

  if (!roleAllowed) {
    return <Navigate to="/app/orders" replace />;
  }

  if (!expensesOnPlan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Wallet className="h-10 w-10 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">Expenses add-on required</h2>
        <p className="max-w-md text-sm text-gray-600">
          Add the Expenses add-on from Profile → Change plan to track restaurant expenses and settle reports.
        </p>
      </div>
    );
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

  async function handleReport() {
    if (!selected) return;
    setReporting(true);
    setActionMsg(null);
    try {
      const data = await apiClient.getExpenseMonthReport(selected.year, selected.month);
      setReport(data);
      setReportOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setReporting(false);
    }
  }

  async function handleShareReport() {
    if (!report) return;
    setActionMsg(null);
    const text = buildExpenseMonthReportText(report);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Monthly report — ${report.period_label}`,
          text,
        });
        return;
      }
      await navigator.clipboard.writeText(text);
      setActionMsg('Report copied to clipboard.');
    } catch {
      setActionMsg('Share cancelled.');
    }
  }

  function handleDownloadReport() {
    if (!report) return;
    const html = buildExpenseMonthReportHtml(report);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-${report.year}-${String(report.month).padStart(2, '0')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMsg('Report downloaded.');
  }

  function handlePrintReport() {
    if (!report) return;
    printBillHtml(buildExpenseMonthReportHtml(report));
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Expenses"
        subtitle="Monthly costs · each new month starts at ₹0"
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
              {option.key === currentExpenseMonthKey()
                ? `${option.label} · until today`
                : option.label}
            </option>
          ))}
        </select>
        {isCurrentMonth ? (
          <span className="text-sm text-gray-500">Showing data through today</span>
        ) : null}
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
          <div className="grid gap-3 sm:grid-cols-1 max-w-sm">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total · {periodLabel || selected?.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(total)}</p>
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

      {!loading ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void handleReport()}
            disabled={reporting || !selected}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {reporting ? <Spinner size="sm" className="text-white" /> : <FileText className="h-4 w-4" />}
            {reporting ? 'Preparing report…' : `Report · ${periodLabel || selected?.label || 'Month'}`}
          </button>
          <p className="text-center text-xs text-gray-500">
            Share or download revenue, expenses, net profit, and total orders for the selected month.
          </p>
        </div>
      ) : null}

      <Modal
        open={reportOpen && !!report}
        onClose={() => setReportOpen(false)}
        title={report ? `Report — ${report.period_label}` : 'Monthly report'}
      >
        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Revenue</p>
                <p className="text-base font-bold">{formatMoney(report.total_revenue)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Expenses</p>
                <p className="text-base font-bold">{formatMoney(report.total_expenses)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Net profit</p>
                <p
                  className={`text-base font-bold ${
                    report.net >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {formatMoney(report.net)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Total orders</p>
                <p className="text-base font-bold">{report.total_orders}</p>
              </div>
            </div>

            {actionMsg && <p className="text-xs text-green-700">{actionMsg}</p>}

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => void handleShareReport()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Print / PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
