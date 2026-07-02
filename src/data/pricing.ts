/**
 * Pricing model — kept in sync with BillGenieFrontEnd/src/config/subscriptionPricing.ts
 */

export type BillingCycle = 'monthly' | 'annual';
export type OperationMode = 'dine_in' | 'counter' | 'both';

export const SUBSCRIPTION_INCLUDED = {
  admins: 1,
  staff: 2,
  tables: 10,
  history_days: 30,
} as const;

export const INCLUDED_TABLES_BASIC = 10;
export const BASIC_MONTHLY_PRICE = 799;
export const ANNUAL_MULTIPLIER = 10; // pay for 10 months, get 12

export const PRICING = {
  extra_staff: 99,
  extra_manager: 149,
  dual_service: 199,
  history_extended: 249,
  inventory: 349,
  kitchen_dine_in: 299,
  kitchen_counter: 199,
  table_staff_bundle: 179,
} as const;

/** Shape sent to the API — mirrors the mobile app exactly */
export interface SubscriptionSelection {
  billing_cycle: BillingCycle;
  operation_mode: OperationMode;
  max_tables: number;
  extra_staff: number;
  extra_managers: number;
  history_extended: boolean;
  inventory: boolean;
  kitchen_dine_in: boolean;
  kitchen_counter: boolean;
}

export const DEFAULT_SUBSCRIPTION_SELECTION: SubscriptionSelection = {
  billing_cycle: 'monthly',
  operation_mode: 'dine_in',
  max_tables: INCLUDED_TABLES_BASIC,
  extra_staff: 0,
  extra_managers: 0,
  history_extended: false,
  inventory: false,
  kitchen_dine_in: false,
  kitchen_counter: false,
};

export interface AddonOption {
  key: keyof Pick<SubscriptionSelection, 'history_extended' | 'inventory' | 'kitchen_dine_in' | 'kitchen_counter'>;
  title: string;
  description: string;
  price: number;
  onlyFor?: OperationMode[];
}

export const ADDON_OPTIONS: AddonOption[] = [
  {
    key: 'kitchen_dine_in',
    title: 'Kitchen — dine-in',
    description: 'KOT queue & ready status for table orders',
    price: PRICING.kitchen_dine_in,
    onlyFor: ['dine_in', 'both'],
  },
  {
    key: 'kitchen_counter',
    title: 'Kitchen — counter / takeaway',
    description: 'Kitchen screen for counter tickets',
    price: PRICING.kitchen_counter,
    onlyFor: ['counter', 'both'],
  },
  {
    key: 'history_extended',
    title: 'Extended order history',
    description: '2 years of order & sales history',
    price: PRICING.history_extended,
  },
  {
    key: 'inventory',
    title: 'Inventory & stock management',
    description: 'Track ingredient levels, get low-stock alerts, and let staff restock',
    price: PRICING.inventory,
  },
];

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

export function calculateMonthlyTotal(sel: SubscriptionSelection): number {
  let total = BASIC_MONTHLY_PRICE;
  if (sel.operation_mode === 'both') total += PRICING.dual_service;
  if (sel.kitchen_dine_in) total += PRICING.kitchen_dine_in;
  if (sel.kitchen_counter) total += PRICING.kitchen_counter;
  if (sel.history_extended) total += PRICING.history_extended;
  if (sel.inventory) total += PRICING.inventory;
  return total;
}
