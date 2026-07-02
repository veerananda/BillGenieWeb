import type { LucideIcon } from 'lucide-react';
import {
  ClipboardList,
  ShoppingBag,
  QrCode,
  Flame,
  RefreshCw,
  Users,
  UtensilsCrossed,
  BarChart3,
  Receipt,
  Package,
  Link2,
} from 'lucide-react';

export type FeatureCategory = 'operations' | 'kitchen' | 'staff' | 'insights';

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  category: FeatureCategory;
  comingSoon?: boolean;
}

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  operations: 'Orders & Billing',
  kitchen: 'Kitchen',
  staff: 'Staff & Setup',
  insights: 'Insights',
};

export const FEATURES: Feature[] = [
  {
    icon: ClipboardList,
    title: 'Dine-in table billing',
    description:
      'Table-wise order tracking from open to checkout, with tax and service charge handled automatically.',
    category: 'operations',
  },
  {
    icon: ShoppingBag,
    title: 'Counter & takeaway orders',
    description:
      'Fast ticket-style ordering for counter service, separate from dine-in tables.',
    category: 'operations',
  },
  {
    icon: QrCode,
    title: 'Self-service QR ordering',
    description:
      'Customers scan a table QR code and place their own order — it lands straight in the same order flow.',
    category: 'operations',
  },
  {
    icon: Receipt,
    title: 'Cash & digital checkout',
    description:
      'Take payments by cash or digital QR, then print or share a receipt in one tap.',
    category: 'operations',
  },
  {
    icon: Flame,
    title: 'Kitchen display (KOT)',
    description:
      'A live ticket queue for the kitchen, covering both dine-in and counter orders, so nothing gets missed.',
    category: 'kitchen',
  },
  {
    icon: RefreshCw,
    title: 'Real-time multi-device sync',
    description:
      'Orders placed on one device appear instantly everywhere else — front desk, kitchen, and counter stay in lockstep.',
    category: 'kitchen',
  },
  {
    icon: UtensilsCrossed,
    title: 'Menu & pricing management',
    description:
      'Add, price, and categorize menu items — including veg/non-veg tagging — in minutes.',
    category: 'staff',
  },
  {
    icon: Users,
    title: 'Staff management with roles',
    description:
      'Admin, manager, staff, and chef roles with scoped access, so everyone sees only what they need.',
    category: 'staff',
  },
  {
    icon: BarChart3,
    title: 'Sales analytics',
    description:
      'A clear daily and historical view of sales, so you always know how the day is going.',
    category: 'insights',
  },
  {
    icon: Receipt,
    title: 'Order history',
    description:
      'Searchable history of every order and bill, with receipts available to reprint or reshare anytime.',
    category: 'insights',
  },
  {
    icon: Package,
    title: 'Inventory & ingredient tracking',
    description:
      'Track stock levels and auto-deduct ingredients as orders go out.',
    category: 'insights',
    comingSoon: true,
  },
  {
    icon: Link2,
    title: 'Zomato / Swiggy integration',
    description:
      'Pull aggregator orders straight into the same kitchen and billing flow.',
    category: 'insights',
    comingSoon: true,
  },
];

export const HOME_HIGHLIGHTS: Feature[] = [
  FEATURES[0], // Dine-in table billing
  FEATURES[2], // Self-service QR ordering
  FEATURES[4], // Kitchen display
  FEATURES[5], // Real-time sync
  FEATURES[7], // Staff management
  FEATURES[8], // Sales analytics
];
