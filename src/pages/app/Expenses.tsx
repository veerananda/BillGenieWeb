import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, FileText, Share2, Download, Wallet } from 'lucide-react';
import { apiClient, type ExpenseSettleReport } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { selectAuthRole } from '../../store/authSlice';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';
import { Modal } from '../../components/app/Modal';
import { formatInr } from '../../data/pricing';
import { buildSettleReportHtml, buildSettleReportText } from '../../lib/settleReport';
import { printBillHtml } from '../../lib/customerBillFormat';

function formatMoney(amount: number): string {
  return formatInr(amount);
}

export function Expenses() {
  const role = useAppSelector(selectAuthRole);
  const allowed = role === 'admin' || role === 'manager';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>();
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

  const [settling, setSettling] = useState(false);
  const [report, setReport] = useState<ExpenseSettleReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.listExpenses();
      setExpenses(data.expenses);
      setManualTotal(data.manual_total);
      setStockTotal(data.stock_total);
      setTotal(data.total);
      setPeriodLabel(data.period_label);
      setYear(data.year);
      setMonth(data.month);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return <Navigate to="/app/orders" replace />;
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
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
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add expense.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.deleteExpense(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense.');
    }
  }

  async function handleSettle() {
    setSettling(true);
    setActionMsg(null);
    try {
      const data = await apiClient.getExpenseSettleReport(year, month);
      setReport(data);
      setReportOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setSettling(false);
    }
  }

  async function handleShare() {
    if (!report) return;
    setActionMsg(null);
    const text = buildSettleReportText(report);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Settlement — ${report.period_label}`,
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

  function handleDownload() {
    if (!report) return;
    const html = buildSettleReportHtml(report);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement-${report.year}-${String(report.month).padStart(2, '0')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setActionMsg('Report downloaded.');
  }

  function handlePrint() {
    if (!report) return;
    printBillHtml(buildSettleReportHtml(report));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expenses" subtitle="Track monthly costs and settle expenditure" />
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Expenses"
        subtitle={`Add costs for ${periodLabel || 'this month'} · includes stock refill spend`}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total this month</p>
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

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">This month’s expenses</h3>
          <p className="text-xs text-gray-500">Manual entries only — stock spend is tracked from Stock Refill.</p>
        </div>
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Wallet className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No manual expenses yet this month.</p>
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

      <button
        type="button"
        onClick={() => void handleSettle()}
        disabled={settling}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
      >
        {settling ? <Spinner size="sm" className="text-white" /> : <FileText className="h-4 w-4" />}
        {settling ? 'Generating…' : 'Settle expenditure'}
      </button>
      <p className="text-center text-xs text-gray-500">
        Generates a report with total expenses, orders, revenue, average order value, and top selling items.
      </p>

      <Modal
        open={reportOpen && !!report}
        onClose={() => setReportOpen(false)}
        title={report ? `Settlement — ${report.period_label}` : 'Settlement'}
      >
        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Expenses</p>
                <p className="text-base font-bold">{formatMoney(report.total_expenses)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Revenue</p>
                <p className="text-base font-bold">{formatMoney(report.total_revenue)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Orders</p>
                <p className="text-base font-bold">{report.total_orders}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-500">Avg order</p>
                <p className="text-base font-bold">{formatMoney(report.average_order_value)}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                Top selling items
              </p>
              {report.top_items?.length ? (
                <ul className="space-y-1.5">
                  {report.top_items.map((item, i) => (
                    <li
                      key={`${item.name}-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-800">
                        {i + 1}. {item.name}{' '}
                        <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                      <span className="font-medium">{formatMoney(item.revenue)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No sales this period.</p>
              )}
            </div>

            {actionMsg && <p className="text-xs text-green-700">{actionMsg}</p>}

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button
                type="button"
                onClick={handlePrint}
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
