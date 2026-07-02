/**
 * Pricing model ported from BillGenieFrontEnd/src/config/subscriptionPricing.ts
 * Keep numbers in sync with the app — this mirrors the same constants and math
 * so the website never drifts from what the product actually charges.
 */

export const SUBSCRIPTION_INCLUDED = {
  admins: 1,
  staff: 2,
  tables: 10,
  history_days: 30,
} as const;

export const BASIC_MONTHLY_PRICE = 799;
export const ANNUAL_MULTIPLIER = 10; // pay for 10 months, get 12 (~2 months free)

export interface AddonOption {
  key: string;
  title: string;
  description: string;
  price: number;
  comingSoon: boolean;
}

export const ADDON_OPTIONS: AddonOption[] = [
  {
    key: 'kitchen_dine_in',
    title: 'Kitchen — dine-in',
    description: 'KOT queue & ready status for table orders',
    price: 299,
    comingSoon: false,
  },
  {
    key: 'kitchen_counter',
    title: 'Kitchen — counter / takeaway',
    description: 'Kitchen screen for counter tickets',
    price: 199,
    comingSoon: false,
  },
  {
    key: 'dual_service',
    title: 'Dine-in + Counter',
    description: 'Run both service modes from one account',
    price: 199,
    comingSoon: false,
  },
  {
    key: 'history_extended',
    title: 'Extended order history',
    description: '2 years of order & sales history',
    price: 249,
    comingSoon: false,
  },
  {
    key: 'inventory',
    title: 'Inventory & stock updates',
    description: 'Track stock and auto-deduct on orders',
    price: 349,
    comingSoon: false,
  },
  {
    key: 'aggregator_integration',
    title: 'Zomato / Swiggy',
    description: 'Aggregator order sync',
    price: 499,
    comingSoon: true,
  },
];

export const STAFF_PRICING = {
  extra_staff: 99,
  extra_manager: 149,
  table_staff_bundle: 179, // +5 tables, +1 staff
  table_staff_bundle_size: 5,
} as const;

export const BASIC_FEATURES = [
  '1 admin + 2 staff accounts',
  '10 dine-in tables included',
  'Dine-in or counter (pick one) — staff sync, no kitchen screen',
  'Menu & staff management',
  'Sales summary',
  'Order history — last 30 days',
  '30-day free trial',
] as const;

export function annualTotal(monthly: number): number {
  return monthly * ANNUAL_MULTIPLIER;
}

export function annualMonthlyEquivalent(monthly: number): number {
  return Math.round(annualTotal(monthly) / 12);
}

export function annualSavings(monthly: number): number {
  return monthly * 2;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
