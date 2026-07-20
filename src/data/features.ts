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
  Moon,
  Smartphone,
  Bell,
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
  insights: 'Insights & Inventory',
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
      'Fast ticket-style ordering for counter service — capture customer name and phone, and show a tracking QR after payment.',
    category: 'operations',
  },
  {
    icon: QrCode,
    title: 'Self-service QR ordering',
    description:
      'Customers scan a table QR code and place their own order — it lands straight in the same order flow.',
    category: 'operations',
    comingSoon: true,
  },
  {
    icon: Bell,
    title: 'Customer assistance QR',
    description:
      'A QR code at each table lets customers call for assistance or review their bill — staff are notified instantly on any device.',
    category: 'operations',
  },
  {
    icon: Smartphone,
    title: 'Cash & UPI checkout',
    description:
      'Accept cash or generate a UPI QR for the exact bill amount from your restaurant UPI ID — no static image needed.',
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
      'Admin, manager, staff, and chef roles with scoped access. Control who can cancel orders, restock inventory, and more.',
    category: 'staff',
  },
  {
    icon: Moon,
    title: 'Auto dark / light mode',
    description:
      'The app switches to dark mode at 6 pm and back to light at 6 am automatically. Staff can override anytime from settings.',
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
    title: 'Inventory & stock management',
    description:
      'Track ingredient levels in real time, get low-stock alerts on the home screen, and let staff restock directly from the app.',
    category: 'insights',
  },
];

export const HOME_HIGHLIGHTS: Feature[] = [
  FEATURES[0], // Dine-in table billing
  FEATURES[3], // Customer assistance QR
  FEATURES[4], // Cash & UPI checkout
  FEATURES[5], // Kitchen display
  FEATURES[6], // Real-time sync
  FEATURES[12], // Inventory & stock management
];
