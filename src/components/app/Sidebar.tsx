import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  ShoppingBag,
  Flame,
  BarChart3,
  Receipt,
  Users,
  Package,
  Store,
  HelpCircle,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectAuthRole, selectAuthName, selectCanRestockInventory, clearAuth } from '../../store/authSlice';
import { selectProfile } from '../../store/profileSlice';
import { parseSubscriptionLimits } from '../../lib/subscriptionLimits';
import apiClient from '../../services/api';
import wsService from '../../services/websocket';
import { clearOrders } from '../../store/ordersSlice';
import { clearMenu } from '../../store/menuSlice';
import { clearTables } from '../../store/tablesSlice';
import { clearProfile } from '../../store/profileSlice';
import { clearInventory } from '../../store/inventorySlice';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  roles?: string[];           // if set, only these roles can see it
  subscriptionKey?: string;   // hide when subscription flag is false
  inventoryAccess?: boolean;  // special combined inventory+role check
}

// Mirrors HomeScreen.tsx in the mobile app exactly.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',          to: '/app/dashboard', icon: LayoutDashboard, roles: ['admin'] },
  { label: 'Menu Management',    to: '/app/menu',      icon: UtensilsCrossed, roles: ['admin', 'manager'] },
  { label: 'Orders & Billing',   to: '/app/orders',    icon: ClipboardList,   roles: ['admin', 'manager', 'staff'], subscriptionKey: 'dine_in_enabled' },
  { label: 'Counter / Takeaway', to: '/app/counter',   icon: ShoppingBag,     roles: ['admin', 'manager', 'staff'], subscriptionKey: 'counter_enabled' },
  { label: 'Kitchen',            to: '/app/kitchen',   icon: Flame,           roles: ['admin', 'manager', 'chef'],  subscriptionKey: 'kitchen' },
  { label: 'Sales Info',         to: '/app/sales',     icon: BarChart3,       roles: ['admin'] },
  { label: 'Order History',      to: '/app/history',   icon: Receipt,         roles: ['admin', 'manager'] },
  { label: 'Inventory',          to: '/app/inventory', icon: Package,         inventoryAccess: true },
  { label: 'Staff Management',   to: '/app/staff',     icon: Users,           roles: ['admin'] },
  { label: 'Restaurant Profile', to: '/app/profile',   icon: Store,           roles: ['admin', 'manager'] },
  { label: 'Customer Support',   to: '/app/support',   icon: HelpCircle },
];

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const role = useAppSelector(selectAuthRole);
  const name = useAppSelector(selectAuthName);
  const profile = useAppSelector(selectProfile);
  const canRestock = useAppSelector(selectCanRestockInventory);

  const limits = parseSubscriptionLimits(
    (profile?.subscription_limits as unknown as Record<string, unknown>) ?? null
  );

  function isItemVisible(item: NavItem): boolean {
    // Role gate
    if (item.roles && role && !item.roles.includes(role)) return false;

    // Subscription gates
    if (item.subscriptionKey === 'dine_in_enabled' && !limits.dine_in_enabled) return false;
    if (item.subscriptionKey === 'counter_enabled' && !limits.counter_enabled) return false;
    if (item.subscriptionKey === 'kitchen' && !limits.kitchen_dine_in && !limits.kitchen_counter) return false;

    // Inventory: subscription must be enabled, then role-specific access
    if (item.inventoryAccess) {
      if (!limits.inventory) return false;
      // admin/manager/chef always have access; staff only if canRestock flag
      if (role === 'admin' || role === 'manager' || role === 'chef') return true;
      if (role === 'staff') return canRestock;
      return false;
    }

    return true;
  }

  function handleLogout() {
    wsService.disconnect();
    apiClient.logout();
    dispatch(clearAuth());
    dispatch(clearOrders());
    dispatch(clearMenu());
    dispatch(clearTables());
    dispatch(clearProfile());
    dispatch(clearInventory());
    navigate('/login');
  }

  const restaurantName = profile?.name ?? 'BillGenie';
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : '';

  return (
    <aside className="flex h-full flex-col bg-white border-r border-gray-100">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <img src="/logo.png" alt="BillGenie" className="h-9 w-9 rounded-xl object-cover shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">{restaurantName}</div>
          <div className="text-xs text-gray-400">{roleLabel}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.filter(isItemVisible).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-semibold">{(name ?? 'U')[0].toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">{name ?? 'User'}</div>
            <div className="text-xs text-gray-400">{roleLabel}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
