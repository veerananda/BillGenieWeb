import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IndianRupee,
  ShoppingBag,
  Calculator,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { PageHeader } from '../../components/app/PageHeader';
import { Spinner } from '../../components/app/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────

type SummaryPeriod = 'today' | 'month';
type ChartPeriod = 'week' | 'last_week' | 'month';

interface SalesSummary {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  period: string;
}

interface SalesAnalytics {
  period: string;
  from: string;
  to: string;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  series: Array<{ date: string; label: string; revenue: number; orders: number }>;
  comparison: {
    previous_revenue: number;
    previous_orders: number;
    revenue_change_pct: number;
    orders_change_pct: number;
    direction: 'up' | 'down' | 'flat';
  };
  top_items: Array<{ name: string; category: string; quantity: number; revenue: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompact(amount: number): string {
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return `${Math.round(amount)}`;
}

function chartPeriodLabel(period: ChartPeriod): string {
  if (period === 'last_week') return 'Last week';
  if (period === 'month') return 'This month';
  return 'This week';
}

function previousPeriodLabel(period: ChartPeriod): string {
  if (period === 'month') return 'last month';
  if (period === 'last_week') return 'the week before';
  return 'last week';
}

function formatCategory(category: string): string {
  const trimmed = (category || '').trim();
  if (!trimmed) return 'Uncategorized';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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

// ─── Line Chart ───────────────────────────────────────────────────────────────

function SalesLineChart({ series }: { series: SalesAnalytics['series'] }) {
  const maxRevenue = Math.max(...series.map((p) => p.revenue), 0) || 1;
  const height = 200;
  const width = Math.max(480, series.length * 36);
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const showEvery = series.length > 14 ? Math.ceil(series.length / 10) : 1;

  if (series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No sales data for this period
      </div>
    );
  }

  const step = series.length === 1 ? 0 : chartW / (series.length - 1);
  const points = series.map((point, index) => {
    const x = padL + index * step;
    const y = padT + chartH - (point.revenue / maxRevenue) * chartH;
    return { ...point, x, y };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + chartH}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT + chartH}
          x2={padL + chartW}
          y2={padT + chartH}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        <text x={4} y={padT + 10} fill="#9ca3af" fontSize="10">
          {formatCompact(maxRevenue)}
        </text>
        <text x={4} y={padT + chartH} fill="#9ca3af" fontSize="10">
          0
        </text>
        <polyline
          points={polyline}
          fill="none"
          stroke="#1bae76"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => (
          <g key={point.date}>
            <title>
              {point.date}: {formatCurrency(point.revenue)} ({point.orders} orders)
            </title>
            <circle cx={point.x} cy={point.y} r={3.5} fill="#1bae76" />
            {index % showEvery === 0 && (
              <text
                x={point.x}
                y={padT + chartH + 16}
                fill="#9ca3af"
                fontSize="10"
                textAnchor="middle"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Sales() {
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>('today');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [analytics, setAnalytics] = useState<SalesAnalytics | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchSummary = useCallback(async (p: SummaryPeriod) => {
    setSummaryLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSalesSummary(p);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales data');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (p: ChartPeriod) => {
    setAnalyticsLoading(true);
    try {
      const data = await apiClient.getSalesAnalytics(p);
      setAnalytics(data);
    } catch (err) {
      console.error(err);
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(summaryPeriod);
  }, [fetchSummary, summaryPeriod]);

  useEffect(() => {
    fetchAnalytics(chartPeriod);
  }, [fetchAnalytics, chartPeriod]);

  const stats: StatCardProps[] = summary
    ? [
        {
          icon: <IndianRupee className="h-6 w-6" />,
          label: 'Total Revenue',
          value: formatCurrency(summary.total_revenue),
          iconBg: 'bg-primary/10',
          iconColor: 'text-primary',
          loading: summaryLoading,
        },
        {
          icon: <ShoppingBag className="h-6 w-6" />,
          label: 'Total Orders',
          value: summary.total_orders.toLocaleString('en-IN'),
          iconBg: 'bg-blue-50',
          iconColor: 'text-blue-600',
          loading: summaryLoading,
        },
        {
          icon: <Calculator className="h-6 w-6" />,
          label: 'Average Order Value',
          value: formatCurrency(summary.average_order_value),
          iconBg: 'bg-amber-50',
          iconColor: 'text-amber-600',
          loading: summaryLoading,
        },
      ]
    : [];

  const selectedChartLabel = chartPeriodLabel(chartPeriod);
  const previousLabel = previousPeriodLabel(chartPeriod);
  const comparison = analytics?.comparison;
  const ComparisonIcon =
    comparison?.direction === 'up'
      ? TrendingUp
      : comparison?.direction === 'down'
        ? TrendingDown
        : Minus;
  const comparisonTone =
    comparison?.direction === 'up'
      ? 'bg-green-50 text-green-700'
      : comparison?.direction === 'down'
        ? 'bg-red-50 text-red-600'
        : 'bg-gray-100 text-gray-600';

  const maxTopQty = useMemo(
    () => Math.max(...(analytics?.top_items.map((i) => i.quantity) ?? [0]), 1),
    [analytics]
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Sales" />

      {/* 1. Graph */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">Sales trend</h2>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
            >
              {selectedChartLabel}
              <ChevronDown className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                {(
                  [
                    { value: 'week', label: 'This week' },
                    { value: 'last_week', label: 'Last week' },
                    { value: 'month', label: 'This month' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setChartPeriod(option.value);
                      setMenuOpen(false);
                    }}
                    className={`block w-full px-4 py-2.5 text-left text-sm font-semibold ${
                      chartPeriod === option.value
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {analyticsLoading && !analytics ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-500">
            <Spinner size="sm" className="text-primary" />
            Loading chart...
          </div>
        ) : analytics ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${comparisonTone}`}
              >
                <ComparisonIcon className="h-3.5 w-3.5" />
                {comparison && comparison.revenue_change_pct >= 0 ? '+' : ''}
                {(comparison?.revenue_change_pct ?? 0).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500">vs {previousLabel}</span>
              <span className="text-xs text-gray-400">
                {formatCurrency(analytics.total_revenue)} · {analytics.total_orders} orders
              </span>
            </div>
            <SalesLineChart series={analytics.series} />
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Could not load sales chart
          </div>
        )}
      </section>

      {/* 2. Sales info */}
      <section>
        <h2 className="mb-3 text-base font-bold text-gray-900">Sales info</h2>
        <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          {(['today', 'month'] as SummaryPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setSummaryPeriod(p)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
                summaryPeriod === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === 'today' ? "Today's Sales" : 'Monthly Revenue'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => fetchSummary(summaryPeriod)}
              className="ml-auto shrink-0 rounded-lg bg-red-100 px-3 py-1 font-semibold hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {summaryLoading && !summary ? (
          <SkeletonCards />
        ) : !summaryLoading && (summary === null || summary.total_orders === 0) ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
            <p className="text-base font-semibold text-gray-700">
              No sales recorded for {summaryPeriod === 'today' ? 'today' : 'this month'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Orders will appear here once customers place them
            </p>
          </div>
        ) : summary && summary.total_orders > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        ) : null}

        {summary && !summaryLoading && (
          <p className="mt-4 text-xs text-gray-400">
            Showing data for:{' '}
            <span className="font-medium capitalize text-gray-500">
              {summaryPeriod === 'today' ? "Today's Sales" : 'Monthly Revenue'}
            </span>
          </p>
        )}

        {summaryLoading && summary && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Spinner size="sm" className="text-primary" />
            Updating...
          </div>
        )}
      </section>

      {/* 3. Top selling items */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Top selling items</h2>
          <span className="text-xs font-semibold text-primary">{selectedChartLabel}</span>
        </div>

        {analyticsLoading && !analytics ? (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-gray-500">
            <Spinner size="sm" className="text-primary" />
            Loading...
          </div>
        ) : analytics && analytics.top_items.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {analytics.top_items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center gap-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatCategory(item.category)} · {item.quantity} sold
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, (item.quantity / maxTopQty) * 100)}%` }}
                    />
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900">
                  {formatCurrency(item.revenue)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">No top items yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Items will rank here once orders are completed
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
