import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  Calculator,
} from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { selectAuthName, selectAuthRole } from '../../store/authSlice';
import { selectLowStockIngredients } from '../../store/inventorySlice';
import { apiClient } from '../../services/api';
import { Spinner } from '../../components/app/Spinner';

interface SalesSummary {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  period: string;
}

type UserRole = 'admin' | 'manager' | 'staff' | 'chef';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function Dashboard() {
  const navigate = useNavigate();

  const name = useAppSelector(selectAuthName);
  const role = useAppSelector(selectAuthRole) as UserRole | null;
  const lowStockIngredients = useAppSelector(selectLowStockIngredients);

  // Dashboard is admin-only — redirect other roles to their first relevant page
  useEffect(() => {
    if (!role) return;
    if (role === 'admin') return;
    if (role === 'manager') { navigate('/app/orders', { replace: true }); return; }
    if (role === 'chef') { navigate('/app/kitchen', { replace: true }); return; }
    // staff
    navigate('/app/orders', { replace: true });
  }, [role, navigate]);

  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSalesLoading(true);
    setSalesError(null);

    apiClient
      .getSalesSummary('today')
      .then((data) => {
        if (!cancelled) setSales(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setSalesError(err instanceof Error ? err.message : 'Failed to load sales');
      })
      .finally(() => {
        if (!cancelled) setSalesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statCards = [
    {
      label: "Today's Revenue",
      value: salesLoading ? null : sales ? formatCurrency(sales.total_revenue) : '—',
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Orders Today',
      value: salesLoading ? null : sales ? String(sales.total_orders) : '—',
      icon: ClipboardList,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Avg Order',
      value: salesLoading ? null : sales ? formatCurrency(sales.average_order_value) : '—',
      icon: Calculator,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {name ?? 'there'}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">{formatDate()}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.bg}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-500">{card.label}</p>
                {salesLoading ? (
                  <div className="mt-1">
                    <Spinner size="sm" className="text-gray-300" />
                  </div>
                ) : salesError ? (
                  <p className="text-sm font-semibold text-red-500">Error</p>
                ) : (
                  <p className="text-xl font-bold text-gray-900">{card.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Low stock banner */}
      {lowStockIngredients.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">
              <span className="font-bold">{lowStockIngredients.length}</span>{' '}
              {lowStockIngredients.length === 1 ? 'ingredient is' : 'ingredients are'} low on stock
            </p>
          </div>
          <button
            onClick={() => navigate('/app/inventory')}
            className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200"
          >
            View inventory
          </button>
        </div>
      )}
    </div>
  );
}
