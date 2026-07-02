import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, ShoppingBag, BarChart2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'month';

interface SalesSummary {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  period: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}

function StatCard({ icon, label, value, iconBg, iconColor, loading }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {loading ? (
          <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
        ) : (
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-100" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Sales() {
  const [period, setPeriod] = useState<Period>('today');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSalesSummary(p);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(period);
  }, [fetchSummary, period]);

  const stats: StatCardProps[] = summary
    ? [
        {
          icon: <TrendingUp className="h-6 w-6" />,
          label: 'Total Revenue',
          value: formatCurrency(summary.total_revenue),
          iconBg: 'bg-primary/10',
          iconColor: 'text-primary',
          loading,
        },
        {
          icon: <ShoppingBag className="h-6 w-6" />,
          label: 'Total Orders',
          value: summary.total_orders.toLocaleString('en-IN'),
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          loading,
        },
        {
          icon: <BarChart2 className="h-6 w-6" />,
          label: 'Average Order Value',
          value: formatCurrency(summary.average_order_value),
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          loading,
        },
      ]
    : [];

  return (
    <div className="flex-1 p-6">
      <PageHeader title="Sales" />

      {/* Period toggle */}
      <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        {(['today', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
              period === p
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p === 'today' ? 'Today' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-600">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => fetchSummary(period)}
            className="ml-auto shrink-0 rounded-lg bg-red-100 px-3 py-1 font-semibold hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat cards or skeleton */}
      {loading && !summary ? (
        <SkeletonCards />
      ) : summary ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : null}

      {/* Period label */}
      {summary && !loading && (
        <p className="mt-6 text-xs text-gray-400">
          Showing data for:{' '}
          <span className="font-medium capitalize text-gray-500">
            {period === 'today' ? 'Today' : 'This Month'}
          </span>
        </p>
      )}

      {/* Loading overlay when switching period */}
      {loading && summary && (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Spinner size="sm" className="text-primary" />
          Updating...
        </div>
      )}
    </div>
  );
}
