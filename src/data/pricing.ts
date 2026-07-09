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
export const MIN_TABLES_DINE_IN = 5;
export const MAX_TABLES = 50;
export const TABLE_STAFF_BUNDLE_SIZE = 5;
export const TABLES_PER_MANAGER = 15;
export const BASIC_MONTHLY_PRICE = 799;
export const ANNUAL_MULTIPLIER = 10; // 10 months = 12 months (2 free)

/** Fixed trial length — keep in sync with restaurant-api TrialDurationDays & mobile TRIAL_DURATION_DAYS */
export const TRIAL_DURATION_DAYS = 15;

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

export interface SubscriptionLineItem {
  id: string;
  label: string;
  amount: number;
}

export interface SubscriptionQuote {
  monthly_subtotal: number;
  annual_total: number;
  annual_monthly_equivalent: number;
  annual_savings: number;
  line_items: SubscriptionLineItem[];
  selection: SubscriptionSelection;
  bundled_staff: number;
  bundled_managers: number;
  table_bundles: number;
}

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
    description: 'Track ingredient levels, low-stock alerts, and staff restock',
    price: PRICING.inventory,
  },
];

export const BASIC_FEATURES = [
  '1 admin + 2 staff accounts',
  '10 dine-in tables included',
  'Dine-in or counter (pick one) — staff sync, no kitchen screen',
  'Menu & staff management',
  'Sales summary',
  `Order history — last 30 days`,
  `${TRIAL_DURATION_DAYS}-day free trial`,
] as const;

// ── Math helpers ─────────────────────────────────────────────────────────────

export function tableBundlesAboveBasic(maxTables: number): number {
  if (maxTables <= INCLUDED_TABLES_BASIC) return 0;
  return Math.floor((maxTables - INCLUDED_TABLES_BASIC) / TABLE_STAFF_BUNDLE_SIZE);
}

export function bundledStaffFromTables(maxTables: number): number {
  return SUBSCRIPTION_INCLUDED.staff + tableBundlesAboveBasic(maxTables);
}

export function bundledManagersFromTables(maxTables: number): number {
  return Math.floor(maxTables / TABLES_PER_MANAGER);
}

export function normalizeMaxTables(maxTables: number): number {
  if (maxTables <= INCLUDED_TABLES_BASIC) {
    return Math.max(MIN_TABLES_DINE_IN, Math.min(maxTables, INCLUDED_TABLES_BASIC));
  }
  const bundles = Math.floor((maxTables - INCLUDED_TABLES_BASIC) / TABLE_STAFF_BUNDLE_SIZE);
  const normalized = INCLUDED_TABLES_BASIC + bundles * TABLE_STAFF_BUNDLE_SIZE;
  return Math.min(MAX_TABLES, Math.max(MIN_TABLES_DINE_IN, normalized));
}

export function calculateSubscriptionQuote(selection: SubscriptionSelection): SubscriptionQuote {
  const clamp = (v: number, max = 50) => Math.max(0, Math.min(max, Math.floor(v)));
  const sel: SubscriptionSelection = {
    ...selection,
    extra_staff: clamp(selection.extra_staff),
    extra_managers: clamp(selection.extra_managers, 20),
    max_tables:
      selection.operation_mode === 'counter'
        ? 0
        : normalizeMaxTables(selection.max_tables || INCLUDED_TABLES_BASIC),
  };
  if (sel.operation_mode !== 'counter' && sel.max_tables < MIN_TABLES_DINE_IN) {
    sel.max_tables = MIN_TABLES_DINE_IN;
  }

  const tableBundles = sel.operation_mode === 'counter' ? 0 : tableBundlesAboveBasic(sel.max_tables);
  const bundledStaff = sel.operation_mode === 'counter'
    ? SUBSCRIPTION_INCLUDED.staff
    : bundledStaffFromTables(sel.max_tables);
  const bundledManagers = sel.operation_mode === 'counter' ? 0 : bundledManagersFromTables(sel.max_tables);

  const line_items: SubscriptionLineItem[] = [
    { id: 'basic', label: `Basic — 1 admin + ${SUBSCRIPTION_INCLUDED.staff} staff, ${INCLUDED_TABLES_BASIC} tables, menu, sales, 30-day history`, amount: BASIC_MONTHLY_PRICE },
  ];
  let monthly = BASIC_MONTHLY_PRICE;

  if (sel.operation_mode === 'both') {
    line_items.push({ id: 'dual_service', label: 'Dine-in + Counter (both service modes)', amount: PRICING.dual_service });
    monthly += PRICING.dual_service;
  }
  if (sel.operation_mode !== 'counter' && tableBundles > 0) {
    const amount = tableBundles * PRICING.table_staff_bundle;
    line_items.push({ id: 'table_staff_bundles', label: `Table bundles ×${tableBundles} (+${tableBundles * TABLE_STAFF_BUNDLE_SIZE} tables, +${tableBundles} staff)`, amount });
    monthly += amount;
  }
  if (sel.operation_mode !== 'counter') {
    line_items.push({ id: 'tables_capacity', label: `${sel.max_tables} tables · ${bundledStaff} staff · ${bundledManagers} manager${bundledManagers === 1 ? '' : 's'} included`, amount: 0 });
  }
  if (sel.extra_staff > 0) {
    const amount = sel.extra_staff * PRICING.extra_staff;
    line_items.push({ id: 'extra_staff', label: `Extra staff ×${sel.extra_staff}`, amount });
    monthly += amount;
  }
  if (sel.extra_managers > 0) {
    const amount = sel.extra_managers * PRICING.extra_manager;
    line_items.push({ id: 'extra_managers', label: `Extra managers ×${sel.extra_managers}`, amount });
    monthly += amount;
  }
  if (sel.history_extended) {
    line_items.push({ id: 'history_extended', label: 'Extended order history (2 years)', amount: PRICING.history_extended });
    monthly += PRICING.history_extended;
  }
  if (sel.inventory) {
    line_items.push({ id: 'inventory', label: 'Inventory & stock management', amount: PRICING.inventory });
    monthly += PRICING.inventory;
  }
  if (sel.kitchen_dine_in) {
    line_items.push({ id: 'kitchen_dine_in', label: 'Kitchen — dine-in orders', amount: PRICING.kitchen_dine_in });
    monthly += PRICING.kitchen_dine_in;
  }
  if (sel.kitchen_counter) {
    line_items.push({ id: 'kitchen_counter', label: 'Kitchen — counter / takeaway', amount: PRICING.kitchen_counter });
    monthly += PRICING.kitchen_counter;
  }

  const annual_total = monthly * ANNUAL_MULTIPLIER;
  return {
    monthly_subtotal: monthly,
    annual_total,
    annual_monthly_equivalent: Math.round(annual_total / 12),
    annual_savings: monthly * 2,
    line_items,
    selection: sel,
    bundled_staff: bundledStaff + sel.extra_staff,
    bundled_managers: bundledManagers + sel.extra_managers,
    table_bundles: tableBundles,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

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
