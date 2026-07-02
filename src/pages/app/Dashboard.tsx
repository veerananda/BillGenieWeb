import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed,
  ShoppingBag,
  ChefHat,
  BookOpen,
  BarChart2,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ClipboardList,
  Calculator,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { selectAuthName } from '../../store/authSlice';
import { selectLowStockIngredients } from '../../store/inventorySlice';
import { apiClient } from '../../services/api';
import { Spinner } from '../../components/app/Spinner';

interface SalesSummary {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  period: string;
}

interface FeatureCard {
  label: string;
  description: string;
  icon: React.ElementType;
  route: string;
  color: string;
  bg: string;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    label: 'Dine-in Orders',
    description: 'Manage tables & orders',
    icon: UtensilsCrossed,
    route: '/app/orders',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Counter Orders',
    description: 'Takeaway & eat-here',
    icon: ShoppingBag,
    route: '/app/counter',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Kitchen Display',
    description: 'Live kitchen tickets',
    icon: ChefHat,
    route: '/app/kitchen',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  {
    label: 'Menu',
    description: 'Items & categories',
    icon: BookOpen,
    route: '/app/menu',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    label: 'Sales',
    description: 'Revenue & reports',
    icon: BarChart2,
    route: '/app/sales',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    label: 'Staff',
    description: 'Team management',
    icon: Users,
    route: '/app/staff',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
];

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
  const dispatch = useAppDispatch();
  void dispatch; // dispatch available for future use

  const name = useAppSelector(selectAuthName);
  const lowStockIngredients = useAppSelector(selectLowStockIngredients);

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

      {/* Feature grid */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-700">Quick Access</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.route}
                onClick={() => navigate(card.route)}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.bg} transition-transform group-hover:scale-110`}
                >
                  <Icon className={`h-6 w-6 ${card.color}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{card.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{card.description}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-gray-300 transition-colors group-hover:text-gray-500" />
              </button>
            );
          })}
        </div>
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
